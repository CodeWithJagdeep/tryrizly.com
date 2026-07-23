import { Inject, Injectable } from "@nestjs/common";
import {
  createActivateAutomationTool,
  createAutomationTool,
  createPauseAutomationTool,
  listAutomationsTool,
} from "./automation.tools";
import { createBusinessSnapshotTool } from "./business.tools";
import { createCalComBriefingTool, createCalComBookTool } from "./calcom.tools";
import { createConnectGoogleTool } from "./connect.tools";
import { createConnectorStatusTool } from "./connector-status.tools";
import { createLookupContactTool } from "./contact.tools";
import {
  createCalendarBriefingTool,
  createCheckCalendarConflictTool,
  createCreateCalendarEventTool,
  createRescheduleCalendarEventTool,
} from "./calendar.tools";
import {
  createEmailConfirmTool,
  createReadEmailBodyTool,
  createSetEmailPreferenceTool,
} from "./email-intake.tools";
import {
  createDraftEmailReplyTool,
  createGmailTriageTool,
  createSendEmailTool,
} from "./gmail.tools";
import {
  createMemoryRecallTool,
  createRememberFactTool,
} from "./memory.tools";
import {
  createEntityBriefTool,
  createRecallDecisionsTool,
} from "../spine/spine.tools";
import { DecisionService } from "../spine/decision.service";
import { EntityResolverService } from "../spine/entity-resolver.service";
import { EntityRepository } from "../spine/entity.repository";
import { EventRepository } from "../spine/event.repository";
import {
  createSetDisplayNameTool,
  createEndAwayModeTool,
  createSetAwayModeTool,
  createSetHonorificTool,
  createSetLanguageTool,
  createSetTimezoneTool,
} from "./preferences.tools";
import { DraftCacheService } from "./draft-cache.service";
import { scheduleReminderTool } from "./queue.tools";
import { createTaskTool } from "./task.tools";
import { createWatchForReplyTool } from "./watch.tools";
import { EmailClassifierService } from "../email/email-classifier.service";
import { EmailPipelineService } from "../email/email-pipeline.service";
import { EmailPreferencesRepository } from "../email/email-preferences.repository";
import { ConnectorService } from "../connectors/connector.service";
import { MongoIntrospectionService } from "../connectors/mongo-introspection.service";
import { PostgresIntrospectionService } from "../connectors/postgres-introspection.service";
import { CalComService } from "../connectors/calcom.service";
import { RazorpayService } from "../connectors/razorpay.service";
import { StripeService } from "../connectors/stripe.service";
import { PayPalService } from "../connectors/paypal.service";
import { GitHubService } from "../connectors/github.service";
import { MpesaService } from "../connectors/mpesa.service";
import { NotionService } from "../connectors/notion.service";
import { SlackService } from "../connectors/slack.service";
import { DiscordService } from "../connectors/discord.service";
import { createPayPalSnapshotTool } from "./paypal.tools";
import { createGitHubBriefingTool } from "./github.tools";
import { createMpesaStatusTool } from "./mpesa.tools";
import { createNotionSearchTool } from "./notion.tools";
import { createSlackBriefingTool } from "./slack.tools";
import { createDiscordSendTool } from "./discord.tools";
import { createSourceUpdatesTool } from "./source-updates.tools";
import { TextToQueryService } from "../connectors/text-to-query.service";
import { TaskRepository } from "../tasks/task.repository";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import type {
  HeyRizTool,
  HeyRizToolDefinition,
  ToolExecutionResult,
} from "./tool.types";
import { GoogleService } from "../google/google.service";
import { LlmRouterService } from "../llm/llm-router.service";
import { VectorMemoryService } from "../memory/vector-memory.service";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { appendActionAudit } from "@heyriz/shared/action-audit";
import {
  claimActionExecution,
  completeActionExecution,
  markActionExecutionUnknown,
} from "@heyriz/shared/action-execution";
import { SourceReceiptRepository } from "../intelligence/source-receipt.repository";
import { AvailabilityService } from "../availability/availability.service";

@Injectable()
export class ToolRegistryService {
  private readonly tools: HeyRizTool[];

  constructor(
    @Inject(VectorMemoryService)
    private readonly vectorMemory: VectorMemoryService,
    @Inject(GoogleService)
    private readonly google: GoogleService,
    @Inject(AvailabilityService)
    private readonly availability: AvailabilityService,
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
    @Inject(CalComService)
    private readonly calcom: CalComService,
    @Inject(ConnectorService)
    private readonly connectorService: ConnectorService,
    @Inject(PostgresIntrospectionService)
    private readonly postgresIntrospection: PostgresIntrospectionService,
    @Inject(MongoIntrospectionService)
    private readonly mongoIntrospection: MongoIntrospectionService,
    @Inject(RazorpayService)
    private readonly razorpay: RazorpayService,
    @Inject(StripeService)
    private readonly stripe: StripeService,
    @Inject(PayPalService)
    private readonly paypal: PayPalService,
    @Inject(GitHubService)
    private readonly github: GitHubService,
    @Inject(MpesaService)
    private readonly mpesa: MpesaService,
    @Inject(NotionService)
    private readonly notion: NotionService,
    @Inject(SlackService)
    private readonly slack: SlackService,
    @Inject(DiscordService)
    private readonly discord: DiscordService,
    @Inject(TextToQueryService)
    private readonly textToQuery: TextToQueryService,
    @Inject(TaskRepository)
    private readonly taskRepository: TaskRepository,
    @Inject(EmailClassifierService)
    private readonly emailClassifier: EmailClassifierService,
    @Inject(EmailPreferencesRepository)
    private readonly emailPreferences: EmailPreferencesRepository,
    @Inject(EmailPipelineService)
    private readonly emailPipeline: EmailPipelineService,
    @Inject(DecisionService)
    private readonly decisions: DecisionService,
    @Inject(EntityResolverService)
    private readonly entityResolver: EntityResolverService,
    @Inject(EntityRepository)
    private readonly entityRepository: EntityRepository,
    @Inject(EventRepository)
    private readonly eventRepo: EventRepository,
    @Inject(DraftCacheService)
    private readonly draftCache: DraftCacheService,
    @Inject(SourceReceiptRepository)
    private readonly sourceReceipts: SourceReceiptRepository,
  ) {
    this.tools = [
      scheduleReminderTool,
      createConnectorStatusTool(this.connectorService),
      createConnectGoogleTool(),
      createLookupContactTool(this.google, this.entityRepository),
      createGmailTriageTool(this.google, this.llm),
      createReadEmailBodyTool(this.google, this.emailClassifier),
      createSetEmailPreferenceTool(this.emailPreferences),
      createEmailConfirmTool(this.emailPipeline),
      createDraftEmailReplyTool(this.google, this.llm, this.draftCache),
      createSendEmailTool(this.google, this.draftCache),
      createWatchForReplyTool(this.google),
      createCalendarBriefingTool(this.google),
      createCheckCalendarConflictTool(this.availability),
      createCreateCalendarEventTool(this.google, this.availability),
      createRescheduleCalendarEventTool(this.google, this.availability),
      createCalComBriefingTool(this.connectorService, this.calcom),
      createCalComBookTool(this.connectorService, this.calcom, this.availability),
      createPayPalSnapshotTool(this.connectorService, this.paypal),
      createGitHubBriefingTool(this.connectorService, this.github),
      createMpesaStatusTool(this.connectorService, this.mpesa),
      createNotionSearchTool(this.connectorService, this.notion),
      createSlackBriefingTool(this.connectorService, this.slack),
      createDiscordSendTool(this.connectorService, this.discord),
      createSourceUpdatesTool(
        this.connectorService,
        this.google,
        this.slack,
        this.notion,
        this.discord,
        this.sourceReceipts,
      ),
      createBusinessSnapshotTool(
        this.connectorService,
        this.postgresIntrospection,
        this.mongoIntrospection,
        this.razorpay,
        this.stripe,
        this.textToQuery,
      ),
      createMemoryRecallTool(this.vectorMemory),
      createRememberFactTool(this.vectorMemory),
      createRecallDecisionsTool(this.decisions),
      createEntityBriefTool(this.entityResolver, this.eventRepo, this.decisions),
      createTaskTool(this.taskRepository),
      createSetHonorificTool(this.preferences),
      createSetDisplayNameTool(this.preferences),
      createSetTimezoneTool(this.preferences),
      createSetLanguageTool(this.preferences),
      createSetAwayModeTool(this.preferences),
      createEndAwayModeTool(this.preferences),
      listAutomationsTool,
      createAutomationTool(),
      createActivateAutomationTool(),
      createPauseAutomationTool(),
    ];
  }

  list(): HeyRizToolDefinition[] {
    return this.tools.map(
      ({
        name,
        category,
        description,
        approvalRequired,
        sensitiveDataPolicy,
      }) => ({
        name,
        category,
        description,
        approvalRequired,
        sensitiveDataPolicy,
      }),
    );
  }

  get(name: string) {
    return this.tools.find((tool) => tool.name === name);
  }

  validatePayload(
    name: string,
    payload: unknown,
  ): { ok: true; value: unknown } | { ok: false; error: string } {
    const tool = this.get(name);
    if (!tool) return { ok: false, error: `unknown tool: ${name}` };
    if (!isPlainRecord(payload)) {
      return { ok: false, error: "tool input must be a JSON object" };
    }
    const serialized = JSON.stringify(payload);
    if (serialized.length > 64_000) {
      return { ok: false, error: "tool input exceeds the 64 KB safety limit" };
    }
    if (hasUnsafeKey(payload)) {
      return { ok: false, error: "tool input contains an unsafe object key" };
    }
    return tool.validate ? tool.validate(payload) : { ok: true, value: payload };
  }

  async execute(input: {
    name: string;
    userId: string;
    payload: unknown;
    context: HeyRizRuntimeContext;
    approvalGranted?: boolean;
    /** Opaque approval id or durable queue job id used for exactly-once claiming. */
    executionId?: string;
  }): Promise<ToolExecutionResult> {
    const tool = this.get(input.name);

    if (!tool) {
      throw new Error(`tool_not_found:${input.name}`);
    }

    const validated = this.validatePayload(input.name, input.payload);
    if (!validated.ok) {
      return {
        tool: tool.name,
        status: "invalid_input",
        message: `Invalid tool input: ${validated.error}`,
      };
    }

    if (tool.approvalRequired && !input.approvalGranted) {
      await appendActionAudit({
        userId: input.userId,
        event: "blocked",
        tool: tool.name,
        payload: validated.value,
      }).catch(() => undefined);
      return {
        tool: tool.name,
        status: "pending_approval",
        message: "This external action requires a server-verified approval.",
      };
    }

    if (tool.approvalRequired && input.executionId) {
      const claim = await claimActionExecution({
        userId: input.userId,
        executionId: input.executionId,
        tool: tool.name,
        payload: validated.value,
      });
      if (claim.state === "completed") return claim.result as ToolExecutionResult;
      if (claim.state !== "claimed") {
        return {
          tool: tool.name,
          status: "transient_error",
          message:
            claim.state === "in_progress"
              ? "This approved action is already executing. I will not run it twice."
              : "The provider outcome is uncertain, so I stopped the retry to prevent a duplicate action.",
        };
      }
    }

    try {
      const result = await tool.execute({
        userId: input.userId,
        payload: validated.value,
        context: input.context,
      });
      if (tool.approvalRequired) {
        await appendActionAudit({
          userId: input.userId,
          event: result.status === "ok" ? "executed" : "failed",
          tool: tool.name,
          payload: validated.value,
          approvalId: input.executionId,
        }).catch(() => undefined);
      }
      if (tool.approvalRequired && input.executionId) {
        await completeActionExecution({
          userId: input.userId,
          executionId: input.executionId,
          tool: tool.name,
          payload: validated.value,
          result,
        });
      }
      return result;
    } catch (error) {
      if (tool.approvalRequired && input.executionId) {
        await markActionExecutionUnknown({
          userId: input.userId,
          executionId: input.executionId,
          tool: tool.name,
          payload: validated.value,
          error,
        }).catch(() => undefined);
      }
      if (tool.approvalRequired) {
        await appendActionAudit({
          userId: input.userId,
          event: "failed",
          tool: tool.name,
          payload: validated.value,
          approvalId: input.executionId,
        }).catch(() => undefined);
      }
      throw error;
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeKey(item, depth + 1));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      hasUnsafeKey(child, depth + 1),
  );
}
