import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { Pool } from "pg";
import type { ToolExecutionResult } from "../tools/tool.types";

export type AgentPlanStepStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "blocked";

export type AgentPlanStep = {
  id: string;
  task: string;
  tool?: string;
  status: AgentPlanStepStatus;
  evidence?: string;
};

export type AgentPlan = {
  id: string;
  userId: string;
  request: string;
  goal: string;
  status: "active" | "waiting_approval" | "completed" | "abandoned";
  steps: AgentPlanStep[];
  createdAt: string;
  updatedAt: string;
};

export type ProposedAgentPlan = {
  goal?: string;
  steps?: Array<{ id?: string; task?: string; tool?: string | null }>;
};

const memoryPlans = new Map<string, AgentPlan>();

@Injectable()
export class AgentPlanRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL) this.pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  async start(userId: string, request: string, proposed: ProposedAgentPlan): Promise<AgentPlan | undefined> {
    const normalized = normalizePlan(userId, request, proposed);
    if (!normalized) return undefined;

    if (!this.pool) {
      for (const [id, plan] of memoryPlans) {
        if (plan.userId === userId && (plan.status === "active" || plan.status === "waiting_approval")) {
          memoryPlans.set(id, { ...plan, status: "abandoned", updatedAt: normalized.createdAt });
        }
      }
      memoryPlans.set(normalized.id, normalized);
      return normalized;
    }

    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `update agent_plans
            set status = 'abandoned', updated_at = now()
          where user_id = $1 and status in ('active', 'waiting_approval')`,
        [userId],
      );
      await client.query(
        `insert into agent_plans
          (id, user_id, request, goal, status, steps, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          normalized.id,
          normalized.userId,
          normalized.request,
          normalized.goal,
          normalized.status,
          JSON.stringify(normalized.steps),
          normalized.createdAt,
          normalized.updatedAt,
        ],
      );
      await client.query("commit");
      return normalized;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getActive(userId: string): Promise<AgentPlan | undefined> {
    if (!this.pool) {
      return [...memoryPlans.values()]
        .filter(
          (plan) =>
            plan.userId === userId &&
            (plan.status === "active" || plan.status === "waiting_approval"),
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    }

    await this.ensureSchema();
    const result = await this.pool.query<{
      id: string;
      userId: string;
      request: string;
      goal: string;
      status: AgentPlan["status"];
      steps: AgentPlanStep[];
      createdAt: string;
      updatedAt: string;
    }>(
      `select id, user_id as "userId", request, goal, status, steps,
              created_at as "createdAt", updated_at as "updatedAt"
         from agent_plans
        where user_id = $1 and status in ('active', 'waiting_approval')
        order by updated_at desc
        limit 1`,
      [userId],
    );
    return result.rows[0];
  }

  async markRunning(plan: AgentPlan, stepId: string | undefined): Promise<AgentPlan> {
    return this.updateStep(plan, stepId, "in_progress");
  }

  async markAwaitingApproval(plan: AgentPlan, stepId: string | undefined): Promise<AgentPlan> {
    return this.updateStep(plan, stepId, "awaiting_approval", undefined, "waiting_approval");
  }

  async recordResult(
    plan: AgentPlan,
    stepId: string | undefined,
    result: ToolExecutionResult,
  ): Promise<AgentPlan> {
    const status: AgentPlanStepStatus = result.status === "ok" ? "completed" : "blocked";
    return this.updateStep(plan, stepId, status, `${result.tool}: ${result.status}`);
  }

  async recordApprovedResult(plan: AgentPlan, result: ToolExecutionResult): Promise<AgentPlan> {
    const step = plan.steps.find(
      (candidate) => candidate.status === "awaiting_approval" && candidate.tool === result.tool,
    );
    return this.recordResult(plan, step?.id, result);
  }

  async complete(plan: AgentPlan): Promise<AgentPlan> {
    const now = new Date().toISOString();
    const completed: AgentPlan = {
      ...plan,
      status: "completed",
      steps: plan.steps.map((step) =>
        step.status === "pending" || step.status === "in_progress"
          ? { ...step, status: "completed" as const, evidence: step.evidence ?? "completed in final synthesis" }
          : step,
      ),
      updatedAt: now,
    };
    await this.persist(completed);
    return completed;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async updateStep(
    plan: AgentPlan,
    stepId: string | undefined,
    status: AgentPlanStepStatus,
    evidence?: string,
    planStatus: AgentPlan["status"] = "active",
  ): Promise<AgentPlan> {
    const target =
      plan.steps.find((step) => step.id === stepId) ??
      plan.steps.find((step) => step.status === "pending" || step.status === "in_progress");
    const updated: AgentPlan = {
      ...plan,
      status: planStatus,
      steps: plan.steps.map((step) =>
        step.id === target?.id ? { ...step, status, ...(evidence ? { evidence } : {}) } : step,
      ),
      updatedAt: new Date().toISOString(),
    };
    await this.persist(updated);
    return updated;
  }

  private async persist(plan: AgentPlan): Promise<void> {
    if (!this.pool) {
      memoryPlans.set(plan.id, plan);
      return;
    }
    await this.ensureSchema();
    await this.pool.query(
      `update agent_plans
          set status = $2, steps = $3, updated_at = $4
        where id = $1 and user_id = $5`,
      [plan.id, plan.status, JSON.stringify(plan.steps), plan.updatedAt, plan.userId],
    );
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    this.ready ??= this.pool
      .query(`
        create table if not exists agent_plans (
          id uuid primary key,
          user_id text not null,
          request text not null,
          goal text not null,
          status text not null,
          steps jsonb not null,
          created_at timestamptz not null,
          updated_at timestamptz not null
        );
        create index if not exists agent_plans_user_active
          on agent_plans (user_id, updated_at desc)
          where status in ('active', 'waiting_approval')
      `)
      .then(() => undefined);
    return this.ready;
  }
}

function normalizePlan(
  userId: string,
  request: string,
  proposed: ProposedAgentPlan,
): AgentPlan | undefined {
  const goal = proposed.goal?.trim().slice(0, 500);
  const rawSteps = proposed.steps?.slice(0, 8) ?? [];
  if (!goal || rawSteps.length < 2) return undefined;

  const used = new Set<string>();
  const steps = rawSteps.flatMap((step, index): AgentPlanStep[] => {
    const task = step.task?.trim().slice(0, 500);
    if (!task) return [];
    let id = step.id?.trim().slice(0, 40) || String(index + 1);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return [{
      id,
      task,
      ...(step.tool?.trim() ? { tool: step.tool.trim().slice(0, 100) } : {}),
      status: "pending",
    }];
  });
  if (steps.length < 2) return undefined;

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    request: request.slice(0, 2_000),
    goal,
    status: "active",
    steps,
    createdAt: now,
    updatedAt: now,
  };
}
