import { Inject, Injectable } from "@nestjs/common";
import { createBusinessSnapshotTool } from "./business.tools";
import { createCalComBriefingTool, createCalComBookTool } from "./calcom.tools";
import { createConnectGoogleTool } from "./connect.tools";
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
import { EventRepository } from "../spine/event.repository";
import {
  createSetDisplayNameTool,
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
import { createPayPalSnapshotTool } from "./paypal.tools";
import { createGitHubBriefingTool } from "./github.tools";
import { createMpesaStatusTool } from "./mpesa.tools";
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

@Injectable()
export class ToolRegistryService {
  private readonly tools: HeyRizTool[];

  constructor(
    @Inject(VectorMemoryService)
    private readonly vectorMemory: VectorMemoryService,
    @Inject(GoogleService)
    private readonly google: GoogleService,
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
    @Inject(EventRepository)
    private readonly eventRepo: EventRepository,
    @Inject(DraftCacheService)
    private readonly draftCache: DraftCacheService,
  ) {
    this.tools = [
      scheduleReminderTool,
      createConnectGoogleTool(),
      createLookupContactTool(this.google),
      createGmailTriageTool(this.google, this.llm),
      createReadEmailBodyTool(this.google, this.emailClassifier),
      createSetEmailPreferenceTool(this.emailPreferences),
      createEmailConfirmTool(this.emailPipeline, this.emailPreferences),
      createDraftEmailReplyTool(this.google, this.llm, this.draftCache),
      createSendEmailTool(this.google, this.draftCache),
      createWatchForReplyTool(this.google),
      createCalendarBriefingTool(this.google),
      createCheckCalendarConflictTool(this.google),
      createCreateCalendarEventTool(this.google),
      createRescheduleCalendarEventTool(this.google),
      createCalComBriefingTool(this.connectorService, this.calcom),
      createCalComBookTool(this.connectorService, this.calcom),
      createPayPalSnapshotTool(this.connectorService, this.paypal),
      createGitHubBriefingTool(this.connectorService, this.github),
      createMpesaStatusTool(this.connectorService, this.mpesa),
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

  async execute(input: {
    name: string;
    userId: string;
    payload: unknown;
    context: HeyRizRuntimeContext;
  }): Promise<ToolExecutionResult> {
    const tool = this.get(input.name);

    if (!tool) {
      throw new Error(`tool_not_found:${input.name}`);
    }

    return tool.execute({
      userId: input.userId,
      payload: input.payload,
      context: input.context,
    });
  }
}
