import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  snapshotAutomationRunPlan,
  type AutomationCursor,
  type AutomationRunAuditEvent,
  type AutomationRunStepResult,
  type AutomationStep,
} from "@heyriz/shared/automations/types";
import { GatewayService } from "../gateway.service";
import { requireInternalSecret } from "../internal-auth";
import { AutomationRepository } from "./automation.repository";
import { AutomationsService } from "./automations.service";

/**
 * User-scoped CRUD, proxied by web's /api/automations/* routes. Every route
 * carries userId explicitly (the internal-secret pattern, same as
 * ApprovalsController — session auth happens upstream in the Next.js app).
 */
@Controller("api/automations")
export class AutomationsController {
  constructor(
    @Inject(AutomationsService)
    private readonly automations: AutomationsService,
    @Inject(AutomationRepository)
    private readonly repo: AutomationRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
  ) {}

  @Get()
  async list(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };
    return { flows: await this.automations.list(userId) };
  }

  @Get(":id")
  async get(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };
    const flow = await this.automations.get(userId, id);
    if (!flow) return { error: "not_found" };
    return { flow };
  }

  @Post()
  async save(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string; id?: string; name?: string; steps?: AutomationStep[] },
  ) {
    requireInternalSecret(secret);
    if (!body.userId || !body.name) return { error: "userId and name are required" };
    try {
      const flow = await this.automations.save(body.userId, {
        id: body.id,
        name: body.name,
        steps: body.steps ?? [],
      });
      return { flow };
    } catch (error) {
      if (error instanceof Error && error.message === "automation_limit_reached") {
        return { error: "automation_limit_reached" };
      }
      throw error;
    }
  }

  /** The flow-builder chat panel — proxied to ai-core's dedicated builder agent. */
  @Post("builder-chat")
  async builderChat(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      userId?: string;
      message?: string;
      history?: Array<{ role?: string; content?: string }>;
      flow?: { id?: string; name?: string; steps?: unknown };
    },
  ) {
    requireInternalSecret(secret);
    if (!body.userId || !body.message) return { ok: false, error: "userId and message are required" };
    try {
      // A single builder LLM generation routinely runs 15-20s, so the default
      // 20s ai-core cap is too tight for this path.
      return await this.gateway.sendToAiCore(
        "automation.builderChat",
        {
          userId: body.userId,
          message: body.message,
          history: body.history ?? [],
          flow: body.flow ?? {},
        },
        75_000,
      );
    } catch {
      return { ok: false, error: "builder_unavailable" };
    }
  }

  /** The Riz Agent step's "Enhance with AI" button. */
  @Post("enhance-prompt")
  async enhancePrompt(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string; prompt?: string },
  ) {
    requireInternalSecret(secret);
    if (!body.userId || !body.prompt) return { ok: false, error: "userId and prompt are required" };
    try {
      return await this.gateway.sendToAiCore("automation.ai.enhancePrompt", {
        userId: body.userId,
        prompt: body.prompt,
      });
    } catch {
      return { ok: false, error: "enhance_unavailable" };
    }
  }

  @Delete(":id")
  async remove(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };
    const ok = await this.automations.remove(userId, id);
    return { ok };
  }

  @Post(":id/activate")
  async activate(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string },
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!body.userId) return { ok: false, error: "userId is required" };
    return this.automations.activate(body.userId, id);
  }

  @Post(":id/pause")
  async pause(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string },
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!body.userId) return { ok: false, error: "userId is required" };
    return this.automations.pause(body.userId, id);
  }

  @Get(":id/runs")
  async runs(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limit: string | undefined,
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };
    const runs = await this.automations.runs(userId, id, limit ? Number(limit) : undefined);
    return { runs };
  }

  // ── Internal-only endpoints for apps/worker's automation-poll job ──────────

  @Get("_internal/active")
  async internalActive(@Headers("x-heyriz-internal-secret") secret: string | undefined) {
    requireInternalSecret(secret);
    return { flows: await this.repo.listActiveFlows() };
  }

  @Post("_internal/:id/cursor")
  async internalUpdateCursor(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string; cursor?: AutomationCursor },
    @Param("id") id: string,
  ) {
    requireInternalSecret(secret);
    if (!body.userId || !body.cursor) return { ok: false };
    await this.repo.updateCursor(body.userId, id, body.cursor);
    return { ok: true };
  }

  @Post("_internal/runs")
  async internalCreateRun(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      flowId?: string;
      userId?: string;
      triggerPayload?: Record<string, unknown>;
      triggerItemId?: string;
    },
  ) {
    requireInternalSecret(secret);
    if (!body.flowId || !body.userId) return { error: "flowId and userId are required" };
    const flow = await this.repo.getFlow(body.userId, body.flowId);
    if (!flow) return { error: "flow_not_found" };
    const startedAt = new Date().toISOString();
    const originalPlan = snapshotAutomationRunPlan(flow.steps);
    const trigger = originalPlan[0];
    const auditTrail: AutomationRunAuditEvent[] = [
      {
        id: "plan:1",
        at: startedAt,
        revision: 1,
        type: "plan_created",
        stepIds: originalPlan.map((step) => step.id),
      },
    ];
    if (trigger) {
      auditTrail.push({
        id: "trigger:1",
        at: startedAt,
        revision: 1,
        type: "step_succeeded",
        stepId: trigger.id,
        evidence: {
          kind: "control",
          provider: trigger.app || "automation-trigger",
          acknowledged: true,
          ...(body.triggerItemId
            ? { resourceId: body.triggerItemId.slice(0, 500) }
            : {}),
          metadata: { source: trigger.app || "automation-trigger" },
        },
      });
    }
    const run = await this.repo.createRun({
      flowId: body.flowId,
      userId: body.userId,
      startedAt,
      status: "running",
      triggerPayload: body.triggerPayload ?? {},
      stepResults: [],
      originalPlan,
      auditTrail,
    });
    return { run };
  }

  @Post("_internal/runs/:runId/finish")
  async internalFinishRun(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      userId?: string;
      status?: "success" | "failed";
      stepResults?: AutomationRunStepResult[];
      auditTrail?: AutomationRunAuditEvent[];
    },
    @Param("runId") runId: string,
  ) {
    requireInternalSecret(secret);
    if (!body.status || !body.userId) return { ok: false, error: "status_and_user_required" };
    const stepResults = body.stepResults ?? [];
    if (
      body.status === "success" &&
      (stepResults.length === 0 ||
        stepResults.some(
          (step) =>
            step.status === "failed" ||
            (step.status === "success" && step.evidence?.acknowledged !== true),
        ))
    ) {
      return { ok: false, error: "success_requires_evidence_for_every_completed_step" };
    }
    if (body.status === "failed" && !stepResults.some((step) => step.status === "failed")) {
      return { ok: false, error: "failed_run_requires_a_failed_step" };
    }
    const existing = await this.repo.getRun(runId, body.userId);
    if (!existing) return { ok: false, error: "run_not_found" };
    const mergedAuditTrail = mergeAutomationAuditTrail(
      existing.auditTrail ?? [],
      body.auditTrail ?? [],
    );
    const revision = mergedAuditTrail.reduce(
      (latest, event) => Math.max(latest, event.revision),
      1,
    );
    const failedStep = stepResults.find((step) => step.status === "failed");
    const verifierId = `${runId}:verification:deterministic:${revision}`;
    if (!mergedAuditTrail.some((event) => event.id === verifierId)) {
      mergedAuditTrail.push({
        id: verifierId,
        at: new Date().toISOString(),
        revision,
        type: "final_verification",
        result: body.status === "success" ? "passed" : "failed",
        method: "deterministic_evidence",
        summary:
          body.status === "success"
            ? "Completion verified. Every successful step has an immutable evidence receipt."
            : `Goal completion failed${failedStep ? ` at ${failedStep.app}` : ""}. The run was not reported as successful.`,
      });
    }
    const updated = await this.repo.finishRun(runId, body.userId, {
      status: body.status,
      finishedAt: new Date().toISOString(),
      stepResults,
      auditTrail: mergedAuditTrail,
    });
    return updated ? { ok: true } : { ok: false, error: "run_not_found" };
  }
}

const MAX_AUTOMATION_AUDIT_EVENTS = 128;

function mergeAutomationAuditTrail(
  retained: AutomationRunAuditEvent[],
  incoming: AutomationRunAuditEvent[],
): AutomationRunAuditEvent[] {
  const merged: AutomationRunAuditEvent[] = [];
  const ids = new Set<string>();
  for (const event of [...retained, ...incoming]) {
    if (
      !event ||
      typeof event.id !== "string" ||
      typeof event.at !== "string" ||
      !Number.isInteger(event.revision) ||
      ids.has(event.id)
    ) {
      continue;
    }
    ids.add(event.id);
    merged.push(event);
    if (merged.length >= MAX_AUTOMATION_AUDIT_EVENTS - 1) break;
  }
  return merged;
}
