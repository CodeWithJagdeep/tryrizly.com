import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability/availability.service";
import { AgentService } from "./agent/agent.service";
import { AiCoreController } from "./ai-core.controller";
import { AiCoreService } from "./ai-core.service";
import { BudgetGateService } from "./billing/budget-gate.service";
import { PlanBudgetService } from "./billing/plan-budget.service";
import { ConnectorRepository } from "./connectors/connector.repository";
import { ConnectorService } from "./connectors/connector.service";
import { ConnectorVaultService } from "./connectors/connector-vault.service";
import { MongoIntrospectionService } from "./connectors/mongo-introspection.service";
import { PostgresIntrospectionService } from "./connectors/postgres-introspection.service";
import { CalComService } from "./connectors/calcom.service";
import { RazorpayService } from "./connectors/razorpay.service";
import { StripeService } from "./connectors/stripe.service";
import { SlackService } from "./connectors/slack.service";
import { NotionService } from "./connectors/notion.service";
import { PayPalService } from "./connectors/paypal.service";
import { GitHubService } from "./connectors/github.service";
import { MpesaService } from "./connectors/mpesa.service";
import { DiscordService } from "./connectors/discord.service";
import { JiraService } from "./connectors/jira.service";
import { PagerDutyService } from "./connectors/pagerduty.service";
import { TrelloService } from "./connectors/trello.service";
import { AirtableService } from "./connectors/airtable.service";
import { TwilioService } from "./connectors/twilio.service";
import { TextToQueryService } from "./connectors/text-to-query.service";
import { NotificationLogRepository } from "./notifications/notification-log.repository";
import { AccountDeletionService } from "./account/account-deletion.service";
import { SourceReceiptRepository } from "./intelligence/source-receipt.repository";
import { AgentPlanRepository } from "./planning/agent-plan.repository";
import { ContextService } from "./context/context.service";
import { EmailClassifierService } from "./email/email-classifier.service";
import { EmailPreferencesRepository } from "./email/email-preferences.repository";
import { EmailPipelineService } from "./email/email-pipeline.service";
import { GoogleService } from "./google/google.service";
import { AnthropicProvider } from "./llm/anthropic.provider";
import { GrokProvider } from "./llm/grok.provider";
import { LlmRouterService } from "./llm/llm-router.service";
import { OpenAiProvider } from "./llm/openai.provider";
import { UsageLedgerService } from "./llm/usage-ledger.service";
import { AutoMemoryService } from "./memory/auto-memory.service";
import { EmbeddingsService } from "./memory/embeddings.service";
import { VectorMemoryService } from "./memory/vector-memory.service";
import { ProactiveService } from "./proactive/proactive.service";
import { DigestService } from "./proactive/digest.service";
import { UserPreferencesRepository } from "./preferences/user-preferences.repository";
import { EntityRepository } from "./spine/entity.repository";
import { EntityResolverService } from "./spine/entity-resolver.service";
import { EventRepository } from "./spine/event.repository";
import { EventIngestService } from "./spine/event-ingest.service";
import { DecisionRepository } from "./spine/decision.repository";
import { DecisionService } from "./spine/decision.service";
import { TaskRepository } from "./tasks/task.repository";
import { DraftCacheService } from "./tools/draft-cache.service";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { AgentSkillRegistryService } from "./skills/agent-skill-registry.service";
import { SkillRouterService } from "./skills/skill-router.service";
import { PromptAssemblerService } from "./prompt/prompt-assembler.service";

@Module({
  controllers: [AiCoreController],
  providers: [
    AgentService,
    AgentSkillRegistryService,
    AccountDeletionService,
    AgentPlanRepository,
    AiCoreService,
    AutoMemoryService,
    AvailabilityService,
    BudgetGateService,
    PlanBudgetService,
    ConnectorRepository,
    ConnectorService,
    ConnectorVaultService,
    ContextService,
    EmailClassifierService,
    EmailPreferencesRepository,
    EmailPipelineService,
    EmbeddingsService,
    GoogleService,
    AnthropicProvider,
    GrokProvider,
    LlmRouterService,
    MongoIntrospectionService,
    OpenAiProvider,
    PostgresIntrospectionService,
    EntityRepository,
    EntityResolverService,
    EventRepository,
    EventIngestService,
    DecisionRepository,
    DecisionService,
    DraftCacheService,
    ProactiveService,
    PromptAssemblerService,
    DigestService,
    CalComService,
    RazorpayService,
    StripeService,
    SlackService,
    NotionService,
    PayPalService,
    GitHubService,
    MpesaService,
    DiscordService,
    JiraService,
    PagerDutyService,
    TrelloService,
    AirtableService,
    TwilioService,
    TextToQueryService,
    TaskRepository,
    ToolRegistryService,
    SkillRouterService,
    UsageLedgerService,
    UserPreferencesRepository,
    VectorMemoryService,
    NotificationLogRepository,
    SourceReceiptRepository,
  ],
})
export class AiCoreModule {}
