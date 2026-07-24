import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { Pool } from "pg";
import type { ToolExecutionResult } from "../tools/tool.types";
import { MAX_PLAN_PIVOTS } from "./agent-plan-supervisor.service";

export type AgentPlanStepStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "blocked"
  | "superseded";

export type AgentPlanStep = {
  id: string;
  task: string;
  tool?: string;
  status: AgentPlanStepStatus;
  evidence?: string;
  attempts?: number;
};

export type AgentPlanRevision = {
  revision: number;
  reason: string;
  preservedStepIds: string[];
  supersededStepIds: string[];
  addedStepIds: string[];
  createdAt: string;
};

export type AgentPlan = {
  id: string;
  userId: string;
  request: string;
  goal: string;
  status: "active" | "waiting_approval" | "completed" | "failed" | "abandoned";
  steps: AgentPlanStep[];
  revision?: number;
  pivotCount?: number;
  revisions?: AgentPlanRevision[];
  createdAt: string;
  updatedAt: string;
};

export type ProposedAgentPlan = {
  goal?: string;
  steps?: Array<{ id?: string; task?: string; tool?: string | null }>;
};

export type ProposedAgentPlanRevision = {
  reason?: string;
  supersedeStepIds?: string[];
  steps?: Array<{ id?: string; task?: string; tool?: string | null }>;
};

export class AgentPlanRevisionError extends Error {
  constructor(
    readonly code:
      | "PIVOT_BUDGET_EXHAUSTED"
      | "INVALID_REVISION"
      | "COMPLETED_STEP_IMMUTABLE",
    message: string,
  ) {
    super(message);
    this.name = "AgentPlanRevisionError";
  }
}

const memoryPlans = new Map<string, AgentPlan>();

@Injectable()
export class AgentPlanRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL)
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  async start(
    userId: string,
    request: string,
    proposed: ProposedAgentPlan,
  ): Promise<AgentPlan | undefined> {
    const normalized = normalizePlan(userId, request, proposed);
    if (!normalized) return undefined;

    if (!this.pool) {
      for (const [id, plan] of memoryPlans) {
        if (
          plan.userId === userId &&
          (plan.status === "active" || plan.status === "waiting_approval")
        ) {
          memoryPlans.set(id, {
            ...plan,
            status: "abandoned",
            updatedAt: normalized.createdAt,
          });
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
          (id, user_id, request, goal, status, steps, revision, pivot_count,
           revision_history, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          normalized.id,
          normalized.userId,
          normalized.request,
          normalized.goal,
          normalized.status,
          JSON.stringify(normalized.steps),
          normalized.revision,
          normalized.pivotCount,
          JSON.stringify(normalized.revisions),
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
      const active = [...memoryPlans.values()]
        .filter(
          (plan) =>
            plan.userId === userId &&
            (plan.status === "active" || plan.status === "waiting_approval"),
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      return active ? hydratePlan(active) : undefined;
    }

    await this.ensureSchema();
    const result = await this.pool.query<{
      id: string;
      userId: string;
      request: string;
      goal: string;
      status: AgentPlan["status"];
      steps: AgentPlanStep[];
      revision: number;
      pivotCount: number;
      revisions: AgentPlanRevision[];
      createdAt: string;
      updatedAt: string;
    }>(
      `select id, user_id as "userId", request, goal, status, steps,
              revision, pivot_count as "pivotCount",
              revision_history as revisions,
              created_at as "createdAt", updated_at as "updatedAt"
         from agent_plans
        where user_id = $1 and status in ('active', 'waiting_approval')
        order by updated_at desc
        limit 1`,
      [userId],
    );
    return result.rows[0] ? hydratePlan(result.rows[0]) : undefined;
  }

  async markRunning(
    plan: AgentPlan,
    stepId: string | undefined,
  ): Promise<AgentPlan> {
    return this.updateStep(
      plan,
      stepId,
      "in_progress",
      undefined,
      "active",
      true,
    );
  }

  async markAwaitingApproval(
    plan: AgentPlan,
    stepId: string | undefined,
  ): Promise<AgentPlan> {
    return this.updateStep(
      plan,
      stepId,
      "awaiting_approval",
      undefined,
      "waiting_approval",
    );
  }

  async recordResult(
    plan: AgentPlan,
    stepId: string | undefined,
    result: ToolExecutionResult,
  ): Promise<AgentPlan> {
    const status: AgentPlanStepStatus =
      result.status === "ok" ? "completed" : "blocked";
    return this.updateStep(
      plan,
      stepId,
      status,
      `${result.tool}: ${result.status}`,
    );
  }

  async recordApprovedResult(
    plan: AgentPlan,
    result: ToolExecutionResult,
  ): Promise<AgentPlan> {
    const step = plan.steps.find(
      (candidate) =>
        candidate.status === "awaiting_approval" &&
        candidate.tool === result.tool,
    );
    const status: AgentPlanStepStatus =
      result.status === "ok" ? "completed" : "blocked";
    return this.updateStep(
      plan,
      step?.id,
      status,
      `${result.tool}: ${result.status}`,
      "active",
      true,
    );
  }

  async complete(plan: AgentPlan): Promise<AgentPlan> {
    const completed = completePlanWithEvidence(plan);
    await this.persist(completed);
    return completed;
  }

  /**
   * Append a bounded patch to the active plan. Historical steps stay in place:
   * completed evidence is immutable, invalid remaining work is superseded, and
   * replacement steps receive fresh ids.
   */
  async revise(
    plan: AgentPlan,
    proposed: ProposedAgentPlanRevision,
  ): Promise<AgentPlan> {
    const updated = revisePlanWithPatch(plan, proposed);
    await this.persist(updated);
    return updated;
  }

  async fail(plan: AgentPlan, reason: string): Promise<AgentPlan> {
    const current = hydratePlan(plan);
    const nextRevision = (current.revision ?? 1) + 1;
    const failed: AgentPlan = {
      ...current,
      status: "failed",
      revision: nextRevision,
      revisions: [
        ...(current.revisions ?? []),
        {
          revision: nextRevision,
          reason: `Terminal failure: ${reason.slice(0, 500)}`,
          preservedStepIds: current.steps.map((step) => step.id),
          supersededStepIds: [],
          addedStepIds: [],
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    await this.persist(failed);
    return failed;
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
    incrementAttempts = false,
  ): Promise<AgentPlan> {
    const target =
      plan.steps.find((step) => step.id === stepId) ??
      plan.steps.find(
        (step) => step.status === "pending" || step.status === "in_progress",
      );
    const updated: AgentPlan = {
      ...plan,
      status: planStatus,
      steps: plan.steps.map((step) =>
        step.id === target?.id
          ? {
              ...step,
              status,
              ...(evidence ? { evidence } : {}),
              ...(incrementAttempts
                ? { attempts: (step.attempts ?? 0) + 1 }
                : {}),
            }
          : step,
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
          set status = $2, steps = $3, revision = $4, pivot_count = $5,
              revision_history = $6, updated_at = $7
        where id = $1 and user_id = $8`,
      [
        plan.id,
        plan.status,
        JSON.stringify(plan.steps),
        plan.revision ?? 1,
        plan.pivotCount ?? 0,
        JSON.stringify(plan.revisions ?? []),
        plan.updatedAt,
        plan.userId,
      ],
    );
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    this.ready ??= this.pool
      .query(
        `
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
        alter table agent_plans
          add column if not exists revision integer not null default 1;
        alter table agent_plans
          add column if not exists pivot_count integer not null default 0;
        alter table agent_plans
          add column if not exists revision_history jsonb not null default '[]'::jsonb;
        create index if not exists agent_plans_user_active
          on agent_plans (user_id, updated_at desc)
          where status in ('active', 'waiting_approval')
      `,
      )
      .then(() => undefined);
    return this.ready;
  }
}

export function completePlanWithEvidence(plan: AgentPlan): AgentPlan {
  const steps = plan.steps.map((step) =>
    (step.status === "pending" || step.status === "in_progress") && !step.tool
      ? {
          ...step,
          status: "completed" as const,
          evidence: step.evidence ?? "completed in final synthesis",
        }
      : step,
  );
  const hasUnverifiedStep = steps.some(
    (step) => step.status !== "completed" && step.status !== "superseded",
  );
  return {
    ...plan,
    status: hasUnverifiedStep ? "active" : "completed",
    steps,
    updatedAt: new Date().toISOString(),
  };
}

export function revisePlanWithPatch(
  plan: AgentPlan,
  proposed: ProposedAgentPlanRevision,
  now = new Date().toISOString(),
): AgentPlan {
  const current = hydratePlan(plan);
  if ((current.pivotCount ?? 0) >= MAX_PLAN_PIVOTS) {
    throw new AgentPlanRevisionError(
      "PIVOT_BUDGET_EXHAUSTED",
      `Plan already used its ${MAX_PLAN_PIVOTS} allowed pivots.`,
    );
  }

  const reason = proposed.reason?.trim().slice(0, 500);
  const requestedIds = [...new Set(proposed.supersedeStepIds ?? [])];
  const targets = requestedIds
    .map((id) => current.steps.find((step) => step.id === id))
    .filter((step): step is AgentPlanStep => Boolean(step));
  if (targets.length !== requestedIds.length) {
    throw new AgentPlanRevisionError(
      "INVALID_REVISION",
      "Every superseded step id must exist in the current plan.",
    );
  }
  if (targets.some((step) => step.status === "completed")) {
    throw new AgentPlanRevisionError(
      "COMPLETED_STEP_IMMUTABLE",
      "A completed plan step cannot be superseded.",
    );
  }
  const superseded = targets.filter((step) => step.status !== "superseded");
  const replacements = normalizeRevisionSteps(
    proposed.steps,
    new Set(current.steps.map((step) => step.id)),
  );
  if (
    (proposed.steps?.length ?? 0) > 8 ||
    replacements.length !== (proposed.steps?.length ?? 0)
  ) {
    throw new AgentPlanRevisionError(
      "INVALID_REVISION",
      "Every replacement step needs a fresh unique id and a non-empty task.",
    );
  }
  if (!reason || superseded.length === 0 || replacements.length === 0) {
    throw new AgentPlanRevisionError(
      "INVALID_REVISION",
      "A pivot requires a reason, at least one active step to supersede, and at least one replacement step.",
    );
  }

  const supersededIds = new Set(superseded.map((step) => step.id));
  const activeAfterRevision =
    current.steps.filter(
      (step) =>
        step.status !== "superseded" &&
        !supersededIds.has(step.id) &&
        step.status !== "completed",
    ).length + replacements.length;
  if (activeAfterRevision > 8) {
    throw new AgentPlanRevisionError(
      "INVALID_REVISION",
      "A revised plan cannot contain more than 8 active incomplete steps.",
    );
  }

  const nextRevision = (current.revision ?? 1) + 1;
  return {
    ...current,
    status: "active",
    steps: [
      ...current.steps.map((step) =>
        supersededIds.has(step.id)
          ? { ...step, status: "superseded" as const }
          : step,
      ),
      ...replacements,
    ],
    revision: nextRevision,
    pivotCount: (current.pivotCount ?? 0) + 1,
    revisions: [
      ...(current.revisions ?? []),
      {
        revision: nextRevision,
        reason,
        preservedStepIds: current.steps
          .filter((step) => !supersededIds.has(step.id))
          .map((step) => step.id),
        supersededStepIds: [...supersededIds],
        addedStepIds: replacements.map((step) => step.id),
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
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
    return [
      {
        id,
        task,
        ...(step.tool?.trim() ? { tool: step.tool.trim().slice(0, 100) } : {}),
        status: "pending",
        attempts: 0,
      },
    ];
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
    revision: 1,
    pivotCount: 0,
    revisions: [
      {
        revision: 1,
        reason: "Initial plan",
        preservedStepIds: [],
        supersededStepIds: [],
        addedStepIds: steps.map((step) => step.id),
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeRevisionSteps(
  rawSteps: ProposedAgentPlanRevision["steps"],
  usedIds: Set<string>,
): AgentPlanStep[] {
  return (rawSteps ?? []).slice(0, 8).flatMap((step): AgentPlanStep[] => {
    const id = step.id?.trim().slice(0, 40);
    const task = step.task?.trim().slice(0, 500);
    if (!id || !task || usedIds.has(id)) return [];
    usedIds.add(id);
    return [
      {
        id,
        task,
        ...(step.tool?.trim() ? { tool: step.tool.trim().slice(0, 100) } : {}),
        status: "pending",
        attempts: 0,
      },
    ];
  });
}

function hydratePlan(plan: AgentPlan): AgentPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      attempts: step.attempts ?? 0,
    })),
    revision: plan.revision ?? 1,
    pivotCount: plan.pivotCount ?? 0,
    revisions: plan.revisions ?? [],
  };
}
