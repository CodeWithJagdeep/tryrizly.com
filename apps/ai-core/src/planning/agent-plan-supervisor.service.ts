import { Injectable } from "@nestjs/common";
import type { AgentPlan, AgentPlanStep } from "./agent-plan.repository";
import type { ToolExecutionResult } from "../tools/tool.types";

export const MAX_PLAN_PIVOTS = 2;
export const MAX_PLAN_STEP_ATTEMPTS = 2;

export type PlanRecoveryCheckpoint = {
  stepId: string;
  resultStatus: ToolExecutionResult["status"];
  canRetry: boolean;
  canPivot: boolean;
  attempts: number;
};

export type PlanReadiness = {
  ready: boolean;
  unresolved: AgentPlanStep[];
  issues: string[];
};

@Injectable()
export class AgentPlanSupervisorService {
  afterToolResult(
    plan: AgentPlan,
    stepId: string | undefined,
    result: ToolExecutionResult,
  ): PlanRecoveryCheckpoint | undefined {
    if (result.status === "ok") return undefined;
    const step =
      plan.steps.find((candidate) => candidate.id === stepId) ??
      plan.steps.find((candidate) => candidate.status === "blocked");
    if (!step) return undefined;
    const attempts = step.attempts ?? 1;
    return {
      stepId: step.id,
      resultStatus: result.status,
      attempts,
      canRetry: attempts < MAX_PLAN_STEP_ATTEMPTS,
      canPivot: (plan.pivotCount ?? 0) < MAX_PLAN_PIVOTS,
    };
  }

  permitsTool(
    checkpoint: PlanRecoveryCheckpoint | undefined,
    planStepId: string | null | undefined,
  ): boolean {
    if (!checkpoint) return true;
    return checkpoint.canRetry && checkpoint.stepId === planStepId;
  }

  readiness(plan: AgentPlan): PlanReadiness {
    const unresolved = plan.steps.filter(
      (step) =>
        step.status !== "completed" &&
        step.status !== "superseded" &&
        // A synthesis-only step is satisfied by the final answer itself.
        !(
          !step.tool &&
          (step.status === "pending" || step.status === "in_progress")
        ),
    );
    const issues = unresolved.map((step) => {
      if (step.status === "blocked") {
        return `${step.id} is blocked after ${step.attempts ?? 1} attempt(s)`;
      }
      if (step.status === "awaiting_approval") {
        return `${step.id} still requires approval`;
      }
      return `${step.id} lacks verified tool evidence`;
    });
    return { ready: unresolved.length === 0, unresolved, issues };
  }

  recoveryInstruction(checkpoint: PlanRecoveryCheckpoint): string {
    const choices = [
      checkpoint.canRetry
        ? `retry plan step "${checkpoint.stepId}" once with corrected input`
        : undefined,
      checkpoint.canPivot
        ? `emit action "revise_plan" and replace the invalid remaining step(s)`
        : undefined,
      "report the typed failure honestly if neither recovery can succeed",
    ].filter(Boolean);
    return (
      `RECOVERY CHECKPOINT: step "${checkpoint.stepId}" returned ${checkpoint.resultStatus}. ` +
      `Do not silently continue to another planned step. ${choices.join("; ")}.`
    );
  }
}
