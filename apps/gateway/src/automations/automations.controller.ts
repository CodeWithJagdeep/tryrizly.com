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
import type { AutomationCursor, AutomationRunStepResult, AutomationStep } from "@heyriz/shared/automations/types";
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
    const flow = await this.automations.save(body.userId, {
      id: body.id,
      name: body.name,
      steps: body.steps ?? [],
    });
    return { flow };
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
    },
  ) {
    requireInternalSecret(secret);
    if (!body.flowId || !body.userId) return { error: "flowId and userId are required" };
    const run = await this.repo.createRun({
      flowId: body.flowId,
      userId: body.userId,
      startedAt: new Date().toISOString(),
      status: "running",
      triggerPayload: body.triggerPayload ?? {},
      stepResults: [],
    });
    return { run };
  }

  @Post("_internal/runs/:runId/finish")
  async internalFinishRun(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      status?: "success" | "failed";
      stepResults?: AutomationRunStepResult[];
    },
    @Param("runId") runId: string,
  ) {
    requireInternalSecret(secret);
    if (!body.status) return { ok: false };
    await this.repo.finishRun(runId, {
      status: body.status,
      finishedAt: new Date().toISOString(),
      stepResults: body.stepResults ?? [],
    });
    return { ok: true };
  }
}
