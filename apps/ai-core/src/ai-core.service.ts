import { Inject, Injectable } from "@nestjs/common";
import { AgentService, type ConversationTurn } from "./agent/agent.service";
import { BudgetGateService } from "./billing/budget-gate.service";
import { ConnectorService } from "./connectors/connector.service";
import type {
  CompleteOAuthInput,
  ConnectorProvider,
  DeleteConnectorInput,
  SaveConnectorInput,
  StartOAuthInput,
} from "./connectors/connector.types";
import { ContextService } from "./context/context.service";
import type {
  HeyRizContextRequest,
  HeyRizEventSource,
} from "./context/context.types";
import { EmailPipelineService } from "./email/email-pipeline.service";
import type { EmailCategory, ExtractedEmailFacts } from "./email/email.types";
import { GoogleService } from "./google/google.service";
import { draftBody, ensureRe, fillAndGuardPlaceholders } from "./tools/gmail.tools";
import { primaryUpdatesInboxQuery } from "./google/gmail-search";
import { AutoMemoryService } from "./memory/auto-memory.service";
import { VectorMemoryService } from "./memory/vector-memory.service";
import type { MemoryWriteInput } from "./memory/memory.types";
import { LlmRouterService } from "./llm/llm-router.service";
import { ProactiveService } from "./proactive/proactive.service";
import { DigestService } from "./proactive/digest.service";
import { UserPreferencesRepository } from "./preferences/user-preferences.repository";
import { NotificationLogRepository } from "./notifications/notification-log.repository";
import { EntityResolverService, parseHeader } from "./spine/entity-resolver.service";
import { EventRepository } from "./spine/event.repository";
import { EventIngestService } from "./spine/event-ingest.service";
import { DecisionService } from "./spine/decision.service";
import { TaskRepository } from "./tasks/task.repository";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { cancelReminder, listReminders } from "@heyriz/shared/queue/queues";
import { enqueueOutboundEmail } from "@heyriz/shared/queue/outbound-email";
import type {
  EmailEventJobData,
  ReminderRequest,
  SpineJobData,
} from "@heyriz/shared/queue/types";

export type ChatPayload = {
  userId?: string;
  message?: string;
  /** Set true together with `pendingApproval` to approve a previously-proposed action. */
  approve?: boolean;
  pendingApproval?: { id?: string; tool: string; payload: unknown };
  /** Recent turns from the same Telegram chat, oldest first. */
  history?: ConversationTurn[];
  /** Where the reply renders: web dashboard (Markdown) or telegram (plain text). Defaults to telegram. */
  channel?: "web" | "telegram";
};

type ToolExecutePayload = {
  userId?: string;
  name: string;
  payload?: unknown;
  source?: HeyRizEventSource;
  authorization?: "scheduled-approved";
  executionId?: string;
};

type CheckThreadReplyPayload = {
  userId?: string;
  threadId?: string;
  baselineMessageCount?: number;
};

@Injectable()
export class AiCoreService {
  constructor(
    @Inject(ContextService)
    private readonly contextService: ContextService,
    @Inject(ToolRegistryService)
    private readonly toolRegistry: ToolRegistryService,
    @Inject(VectorMemoryService)
    private readonly vectorMemory: VectorMemoryService,
    @Inject(LlmRouterService)
    private readonly llmRouter: LlmRouterService,
    @Inject(AgentService)
    private readonly agent: AgentService,
    @Inject(AutoMemoryService)
    private readonly autoMemory: AutoMemoryService,
    @Inject(ProactiveService)
    private readonly proactive: ProactiveService,
    @Inject(DigestService)
    private readonly digest: DigestService,
    @Inject(ConnectorService)
    private readonly connectorService: ConnectorService,
    @Inject(GoogleService)
    private readonly google: GoogleService,
    @Inject(EmailPipelineService)
    private readonly emailPipeline: EmailPipelineService,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
    @Inject(EntityResolverService)
    private readonly entityResolver: EntityResolverService,
    @Inject(EventIngestService)
    private readonly eventIngest: EventIngestService,
    @Inject(EventRepository)
    private readonly eventRepo: EventRepository,
    @Inject(DecisionService)
    private readonly decisions: DecisionService,
    @Inject(TaskRepository)
    private readonly taskRepository: TaskRepository,
    @Inject(BudgetGateService)
    private readonly budgetGate: BudgetGateService,
    @Inject(NotificationLogRepository)
    private readonly notificationLog: NotificationLogRepository,
  ) {}

  /** Spine: active (non-superseded) decisions, optionally filtered by topic. */
  recallDecisions(body: { userId?: string; topic?: string }) {
    return this.decisions.recall(body.userId ?? env.DEFAULT_USER_ID, body.topic);
  }

  /** Current-cycle AI spend vs. plan budget + per-task breakdown, for the dashboard's Usage view. */
  getUsage(body: { userId?: string }) {
    return this.budgetGate.summary(body.userId ?? env.DEFAULT_USER_ID);
  }

  /** All users' spend, highest first — admin-only usage view. */
  listAllUsage(body: { sinceDays?: number }) {
    return this.budgetGate.adminSummary(body.sinceDays ?? 30);
  }

  /** Open follow-up tasks + pending BullMQ reminders, for the dashboard's Scheduled view. */
  async listScheduled(body: { userId?: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const [tasks, reminders] = await Promise.all([
      this.taskRepository.listAll(userId),
      listReminders(userId).catch(() => []),
    ]);
    return { tasks, reminders };
  }

  async markTaskDone(body: { id: string; userId: string }) {
    const updated = await this.taskRepository.markDone(body.id, body.userId);
    return { ok: updated };
  }

  async cancelScheduledReminder(body: { id: string; userId: string }) {
    const cancelled = await cancelReminder(body.id, body.userId);
    return { ok: cancelled };
  }

  /** Spine: resolve a person/company reference to a canonical entity id. */
  resolveEntity(body: { userId?: string; from?: string; name?: string; email?: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    if (body.from) {
      return this.entityResolver.resolveFromHeader(userId, body.from, "api");
    }
    return this.entityResolver.resolve(userId, {
      name: body.name,
      email: body.email,
      source: "api",
    });
  }

  listPeople(body: { userId?: string; limit?: number }) {
    return this.entityResolver.listPeople(body.userId ?? env.DEFAULT_USER_ID, body.limit ?? 50);
  }

  /** Spine: seed the timeline from the last/next N days of calendar + inbox. */
  async backfillSpine(body: { userId?: string; days?: number }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const days = Math.min(Math.max(body.days ?? 14, 1), 60);
    const now = Date.now();
    let meetings = 0;
    let emails = 0;

    const cal = await this.google.listEvents(userId, {
      timeMin: new Date(now - days * 86_400_000),
      timeMax: new Date(now + days * 86_400_000),
      maxResults: 100,
    });
    if (cal.connected) {
      for (const e of cal.events) {
        if (!e.start) continue;
        await this.eventIngest
          .recordEvent(userId, {
            type: "meeting",
            source: "calendar",
            sourceId: e.id,
            timestamp: new Date(e.start),
            content: e.title,
            metadata: { start: e.start, end: e.end },
            participants: [
              ...(e.organizer ? [{ email: e.organizer, role: "organizer" }] : []),
              ...e.attendees.map((a) => ({ email: a, role: "attendee" })),
            ],
          })
          .then(() => {
            meetings += 1;
          })
          .catch(() => undefined);
      }
    }

    const mail = await this.google.listThreads(userId, {
      q: primaryUpdatesInboxQuery(`newer_than:${days}d`),
      maxResults: 50,
    });
    if (mail.connected) {
      for (const m of mail.messages) {
        await this.eventIngest
          .recordEvent(userId, {
            type: "email",
            source: "gmail",
            sourceId: m.id,
            threadId: m.threadId,
            timestamp: m.date ? new Date(m.date) : new Date(),
            content: m.subject,
            metadata: { from: m.from },
            participants: [{ ...parseHeader(m.from), role: "sender" }],
          })
          .then(() => {
            emails += 1;
          })
          .catch(() => undefined);
      }
    }

    return { ok: true, meetings, emails, days };
  }

  /** Spine: recent timeline with linked entity names (verification/inspection). */
  timeline(body: { userId?: string; limit?: number }) {
    return this.eventRepo.recentTimeline(
      body.userId ?? env.DEFAULT_USER_ID,
      Math.min(body.limit ?? 20, 100),
    );
  }

  async getUserPreferences(body: { userId?: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const [timezone, honorific, language, avatarUrl] = await Promise.all([
      this.preferences.getTimezone(userId),
      this.preferences.getHonorific(userId),
      this.preferences.getLanguage(userId),
      this.preferences.getAvatarUrl(userId),
    ]);
    return { timezone, honorific, language, avatarUrl };
  }

  async setUserAvatar(body: { userId?: string; avatarUrl: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    await this.preferences.setAvatarUrl(userId, body.avatarUrl);
    return { ok: true };
  }

  async syncUser(body: { userId?: string; name?: string; timezone?: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    let didSomething = false;

    if (body.name) {
      await this.preferences.syncDisplayNameFromSignup(userId, body.name);
      didSomething = true;
    }

    if (body.timezone) {
      try {
        await this.preferences.setTimezone(userId, body.timezone);
        didSomething = true;
      } catch {
        return { ok: false };
      }
    }

    return { ok: didSomething };
  }

  proactiveBrief(body: { userId?: string }) {
    return this.proactive.morningBrief(body.userId ?? env.DEFAULT_USER_ID);
  }

  /**
   * Scheduler entrypoint: only send the morning brief when it's actually
   * `briefHour` in *this* user's saved timezone. The worker fires this hourly for
   * every user, so a user in Asia/Kolkata gets their brief in the Kolkata morning
   * and one in America/Guatemala gets it in the Guatemala morning — not all at a
   * single global UTC hour. On-demand briefs still use proactiveBrief directly.
   */
  async proactiveBriefIfDue(body: { userId?: string; briefHour?: number }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const briefHour = body.briefHour ?? env.MORNING_BRIEF_HOUR;
    const timezone = await this.preferences.getTimezone(userId);
    const localHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    if (localHour !== briefHour) {
      return { ok: true, skipped: true as const, localHour, timezone };
    }
    return this.proactive.morningBrief(userId);
  }

  proactiveSync(body: { userId?: string; source?: "calendar" | "calcom" }) {
    return this.proactive.syncMeetingReminders(
      body.userId ?? env.DEFAULT_USER_ID,
      body.source ?? "calendar",
    );
  }

  /**
   * Durable spine ingest (called from the spine BullMQ worker). Does the timeline
   * write + entity link for every email, and decision extraction for substantive
   * ones. Throws on failure so BullMQ retries — the opposite of the old
   * fire-and-forget. The body is fetched live here, never carried on the queue.
   */
  async ingestEmailSpine(data: SpineJobData) {
    const sender = parseHeader(data.from);
    const senderName =
      cleanSenderHint(data.contactCandidate?.name) ??
      cleanSenderHint(data.senderName) ??
      sender.name;
    const senderEmail = data.contactCandidate?.isRealContact && data.contactCandidate.email
      ? data.contactCandidate.email
      : sender.email;
    // Parse CC header into extra participants
    const ccParticipants = parseCcHeader(data.cc ?? "").map((p) => ({
      ...p,
      role: "cc",
    }));

    await this.eventIngest.recordEvent(data.userId, {
      type: "email",
      source: "gmail",
      sourceId: data.messageId,
      threadId: data.threadId,
      timestamp: new Date(),
      content: data.subject,
      metadata: { from: data.from },
      participants: [
        {
          ...sender,
          name: senderName,
          email: senderEmail,
          role: "sender",
          senderType: data.senderType,
          isAutomated: data.isAutomated,
          isMarketing: data.isMarketing,
          contactCandidate: data.contactCandidate,
        },
        ...ccParticipants,
      ],
    });

    const msg = await this.google.getMessage(data.userId, data.messageId, "full");
    const body = msg.connected ? msg.message.body : "";

    if (data.extractDecisions && body) {
      await this.decisions.extractFromEmail(data.userId, {
        from: data.from,
        subject: data.subject,
        body,
      });
    }

    if (body) {
      // Mine signature contacts (emails, phones, LinkedIn/GitHub URLs) from body.
      await enrichContactsFromBody(data.userId, body, this.entityResolver);
    }

    return { ok: true as const };
  }

  weeklyDigest(body: { userId?: string }) {
    return this.digest.weeklyDigest(body.userId ?? env.DEFAULT_USER_ID);
  }

  dailyAnomalyCheck(body: { userId?: string }) {
    return this.digest.dailyAnomalyCheck(body.userId ?? env.DEFAULT_USER_ID);
  }

  async checkThreadReply(body: CheckThreadReplyPayload) {
    if (!body.threadId) {
      throw new Error("threadId_required");
    }

    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const res = await this.google.getThreadMessages(userId, body.threadId);
    if (!res.connected) {
      return {
        connected: false,
        hasReply: false,
        messageCount: 0,
      };
    }

    const messageCount = res.messages.length;
    const baseline = body.baselineMessageCount ?? 1;
    return {
      connected: true,
      hasReply: messageCount > baseline,
      messageCount,
    };
  }

  healthCheck() {
    return {
      ok: true,
      service: "ai-core",
      framework: "nestjs",
      transport: "tcp",
      aiProvider: this.llmRouter.getActiveProviderName(),
    };
  }

  listTools() {
    return {
      tools: this.toolRegistry.list(),
    };
  }

  async chat(body: ChatPayload) {
    const message = body.message?.trim();

    if (!message) {
      throw new Error("message_required");
    }

    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const context = await this.contextService.build({
      userId,
      source: "telegram",
      message,
    });

    const approval =
      body.approve && body.pendingApproval
        ? {
            tool: body.pendingApproval.tool,
            payload: body.pendingApproval.payload,
            id: body.pendingApproval.id,
          }
        : undefined;

    const result = await this.agent.run({
      userId,
      message,
      context,
      approval,
      history: body.history,
      channel: body.channel,
    });

    if (env.BACKGROUND_AI_ENABLED && (await this.budgetGate.check(userId)).state !== "exceeded") {
      // Let long-term memory build itself, without blocking the reply.
      void this.autoMemory
        .captureTurn({ userId, message, toolResults: result.toolResults })
        .catch((error: unknown) =>
          logger.warn("auto-memory capture failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );

      // Episodic recall stores only principal-authored text. Assistant replies
      // can contain mistakes or tentative synthesis and must never become facts.
      if (shouldStoreEpisode(message)) {
        void this.vectorMemory
          .remember({
            userId,
            source: "telegram",
            summary: `Principal said: ${message.slice(0, 800)}`,
            metadata: {
              kind: "episode",
              provenance: "principal",
              confidence: "high",
            },
          })
          .catch((error: unknown) =>
            logger.warn("turn vector-store failed", {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
      }

      // Spine: capture explicit decisions the principal made this turn (gated,
      // best-effort, off the hot path).
      void this.decisions
        .extractFromChat(userId, message)
        .catch((error: unknown) =>
          logger.warn("decision extract failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }

    return {
      reply: result.reply,
      userId,
      intent: "chat",
      aiProvider: result.provider,
      pendingApproval: result.pendingApproval,
      steps: result.steps,
      toolResults: result.toolResults,
    };
  }

  async ingestEvent(body: HeyRizContextRequest) {
    const context = await this.contextService.build({
      ...body,
      userId: body.userId ?? "default",
    });
    const toolName = this.selectToolForEvent(body.source);

    if (!toolName) {
      return {
        action: "log_only",
        message: "No tool selected for event source.",
        context,
      };
    }

    const result = await this.toolRegistry.execute({
      name: toolName,
      userId: context.userId,
      payload: body,
      context,
    });

    if (env.BACKGROUND_AI_ENABLED && (await this.budgetGate.check(context.userId)).state !== "exceeded") {
      void this.autoMemory
        .captureEvent({
          userId: context.userId,
          source: body.source,
          result,
          message: body.message,
        })
        .catch((error: unknown) =>
          logger.warn("auto-memory event capture failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }

    return {
      action:
        result.priority === "HIGH"
          ? "notify"
          : result.priority === "MEDIUM"
            ? "digest"
            : "silent",
      result,
      context,
    };
  }

  async executeTool(body: ToolExecutePayload) {
    const userId = body.userId ?? "default";
    const context = await this.contextService.build({
      userId,
      source: body.source ?? "telegram",
      message: JSON.stringify(body.payload ?? {}),
    });

    return this.toolRegistry.execute({
      name: body.name,
      userId,
      payload: body.payload ?? {},
      context,
      approvalGranted: body.authorization === "scheduled-approved",
      executionId: body.executionId,
    });
  }

  remember(body: MemoryWriteInput) {
    return this.vectorMemory.remember(body);
  }

  listMemories(body: { userId: string; limit?: number }) {
    return this.vectorMemory.list(body.userId, body.limit);
  }

  async forgetMemory(body: { userId: string; id: string }) {
    return { removed: await this.vectorMemory.forget(body.userId, body.id) };
  }

  async forgetAllMemories(body: { userId: string }) {
    return { removed: await this.vectorMemory.forgetAll(body.userId) };
  }

  async listEmailMemories(body: { userId?: string; limit?: number; includeLowValue?: boolean }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const limit = body.limit ?? 50;
    const fetchLimit = body.includeLowValue ? limit : Math.max(limit * 5, limit);
    const memories = await this.vectorMemory.listBySource(userId, "gmail", fetchLimit);

    if (body.includeLowValue) return memories.slice(0, limit);

    return memories
      .filter((memory) => !LOW_VALUE_EMAIL_CATEGORIES.has(String(memory.metadata.category ?? "")))
      .slice(0, limit);
  }

  async listChatMemories(body: { userId?: string; limit?: number }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const limit = body.limit ?? 50;
    const memories = await this.vectorMemory.listBySource(userId, "telegram", limit);
    // Only conversation turns have the "User: ... | Assistant: ..." shape —
    // auto-memory notes and event summaries don't and would break parsing.
    return memories.filter((m) => m.metadata.kind === "turn");
  }

  async scheduleReminder(body: ReminderRequest) {
    if (!body.message || (!body.runAt && !body.repeat)) {
      throw new Error("message_and_runAt_or_repeat_required");
    }

    const context = await this.contextService.build({
      userId: body.userId ?? "default",
      source: "telegram",
      message: body.message,
    });

    return this.toolRegistry.execute({
      name: "schedule_reminder",
      userId: body.userId ?? "default",
      payload: body,
      context,
    });
  }

  listConnectors(body: { userId?: string }) {
    return this.connectorService.list(body.userId ?? "default");
  }

  async activeUsers(body: { provider?: string }) {
    const provider = parseConnectorProvider(body.provider);
    // "gmail"/"calendar" rows are the new split connections; "google" is the
    // legacy combined row from before the split — match either until users
    // reconnect.
    const providers =
      provider === "gmail" || provider === "calendar"
        ? ([provider, "google"] as ConnectorProvider[])
        : provider;
    const users = await this.connectorService.listActiveUserIds(providers);
    return { users };
  }

  saveConnector(body: SaveConnectorInput) {
    return this.connectorService.saveManual(body);
  }

  deleteConnector(body: DeleteConnectorInput) {
    return this.connectorService.delete(body.userId ?? "default", body.provider);
  }

  deleteConnectorById(body: { userId?: string; id: string }) {
    return this.connectorService.deleteById(body.userId ?? "default", body.id);
  }

  updateConnectorMetadata(body: { userId?: string; id: string; metadata: Record<string, unknown> }) {
    return this.connectorService.updateMetadata(body.userId ?? "default", body.id, body.metadata);
  }

  async checkConnectorNotification(body: { userId: string; provider: string }) {
    const provider = parseConnectorProvider(body.provider);
    if (!provider) return { enabled: true };
    const enabled = await this.connectorService.isNotificationsEnabled(body.userId, provider);
    return { enabled };
  }

  async logNotification(body: { userId: string; message: string; source?: string; sentAt?: string }) {
    await this.notificationLog.append({
      userId: body.userId,
      message: body.message,
      source: body.source ?? "system",
      sentAt: body.sentAt ?? new Date().toISOString(),
    });
    return { ok: true };
  }

  async listNotifications(body: { userId: string; limit?: number }) {
    const entries = await this.notificationLog.list(body.userId, body.limit ?? 50);
    return { entries };
  }

  startConnectorOAuth(body: StartOAuthInput) {
    return this.connectorService.startOAuth(body);
  }

  completeConnectorOAuth(body: CompleteOAuthInput) {
    return this.connectorService.completeOAuth(body);
  }

  async listRecentEmails(body: { userId?: string; maxResults?: number }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const res = await this.google.listThreads(userId, {
      q: primaryUpdatesInboxQuery("is:unread newer_than:1h"),
      maxResults: body.maxResults ?? 10,
    });
    if (!res.connected) {
      return { connected: false, messages: [] };
    }
    return { connected: true, messages: res.messages };
  }

  processEmail(body: EmailEventJobData) {
    return this.emailPipeline.process({
      userId: body.userId ?? env.DEFAULT_USER_ID,
      messageId: body.messageId,
      threadId: body.threadId,
      from: body.from,
      subject: body.subject,
      snippet: body.snippet,
    });
  }

  confirmEmailAction(body: {
    userId?: string;
    messageId?: string;
    threadId?: string;
    category?: EmailCategory;
    facts?: ExtractedEmailFacts;
    action?: "remind" | "schedule" | "draft" | "watch";
    learnPreference?: boolean;
  }) {
    if (!body.messageId || !body.threadId || !body.category || !body.facts || !body.action) {
      throw new Error("email_confirm_missing_fields");
    }
    return this.emailPipeline.confirmAction({
      userId: body.userId ?? env.DEFAULT_USER_ID,
      messageId: body.messageId,
      threadId: body.threadId,
      category: body.category,
      facts: body.facts,
      action: body.action,
      learnPreference: body.learnPreference,
    });
  }

  async scheduleOutboundEmail(payload: {
    userId?: string;
    to: string;
    subject: string;
    body: string;
    sendAt: string;
    threadId?: string;
    inReplyTo?: string;
  }) {
    const userId = payload.userId ?? env.DEFAULT_USER_ID;
    const sendAt = new Date(payload.sendAt);
    if (isNaN(sendAt.getTime())) throw new Error("invalid_sendAt");

    await enqueueOutboundEmail(
      {
        userId,
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        threadId: payload.threadId,
        inReplyTo: payload.inReplyTo,
      },
      sendAt,
    );
    return { ok: true, sendAt: sendAt.toISOString() };
  }

  async getGmailMessage(body: { userId?: string; messageId: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const res = await this.google.getMessage(userId, body.messageId, "full");
    if (!res.connected) return { connected: false as const };
    return { connected: true as const, message: res.message };
  }

  async draftEmailReply(body: { userId?: string; messageId: string; instructions?: string }) {
    const userId = body.userId ?? env.DEFAULT_USER_ID;
    const res = await this.google.getMessage(userId, body.messageId, "full");
    if (!res.connected) return { connected: false as const };

    const original = res.message;
    // HTML-only messages have no text/plain part — give the drafting prompt
    // a stripped-tag fallback rather than an empty body.
    const plainSource = original.body || stripHtml(original.bodyHtml ?? "");
    const principalName = await this.preferences.getDisplayName(userId);
    const text = await draftBody(
      this.llmRouter,
      userId,
      { ...original, body: plainSource },
      body.instructions,
      principalName,
    );

    return {
      connected: true as const,
      to: original.from,
      subject: ensureRe(original.subject),
      body: text,
      threadId: original.threadId,
      inReplyTo: original.messageIdHeader,
    };
  }

  async sendEmailReply(payload: {
    userId?: string;
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
    sendAt?: string;
  }) {
    const userId = payload.userId ?? env.DEFAULT_USER_ID;
    const principalName = await this.preferences.getDisplayName(userId);
    const guarded = fillAndGuardPlaceholders(payload.body, principalName);
    if (guarded.leftoverPlaceholder) {
      return { ok: false as const, error: "unfilled_placeholder", placeholder: guarded.leftoverPlaceholder };
    }

    if (payload.sendAt) {
      const sendAt = new Date(payload.sendAt);
      if (isNaN(sendAt.getTime())) throw new Error("invalid_sendAt");
      await enqueueOutboundEmail(
        {
          userId,
          to: payload.to,
          subject: payload.subject,
          body: guarded.body,
          threadId: payload.threadId,
          inReplyTo: payload.inReplyTo,
        },
        sendAt,
      );
      return { ok: true as const, scheduled: true as const, sendAt: sendAt.toISOString() };
    }

    const res = await this.google.sendMessage(userId, {
      to: payload.to,
      subject: payload.subject,
      body: guarded.body,
      threadId: payload.threadId,
      inReplyTo: payload.inReplyTo,
    });
    if (!res.connected) return { ok: false as const, error: "not_connected" };
    return { ok: true as const, scheduled: false as const, messageId: res.messageId, threadId: res.threadId };
  }

  private selectToolForEvent(source: HeyRizEventSource) {
    if (source === "gmail") {
      return "gmail_triage";
    }

    if (source === "calendar") {
      return "calendar_briefing";
    }

    if (source === "database" || source === "razorpay") {
      return "business_snapshot";
    }

    return undefined;
  }
}

const LOW_VALUE_EMAIL_CATEGORIES = new Set(["newsletter", "general_low", "otp"]);

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseConnectorProvider(provider: string | undefined): ConnectorProvider | undefined {
  const allowed = new Set([
    "google", "gmail", "calendar", "telegram", "postgres", "mongodb", "razorpay",
    "stripe", "calcom", "slack", "notion", "custom_api", "paypal", "github", "mpesa",
  ]);
  return provider && allowed.has(provider) ? (provider as ConnectorProvider) : undefined;
}

function cleanSenderHint(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes("@")) return undefined;
  return trimmed.length > 80 ? trimmed.slice(0, 80).trim() : trimmed;
}

/** Split a raw CC header like "Name <email>, Name2 <email2>" into participants. */
function parseCcHeader(cc: string): { name?: string; email?: string }[] {
  if (!cc.trim()) return [];
  return cc
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => parseHeader(part.trim()))
    .filter((p) => p.email || p.name);
}

const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const PHONE_CONTEXT_RE = /\b(phone|mobile|tel|telephone|cell|call|whatsapp|wa|contact)\b/i;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/gi;
const GITHUB_RE = /https?:\/\/(?:www\.)?github\.com\/(?!features|marketplace|pricing|topics|orgs\b)[\w-]+\/?/gi;
const EMAIL_IN_BODY_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

/**
 * Extracts email addresses, phone numbers, and LinkedIn URLs from the email
 * body (typically from signature blocks) and upserts them as enrichment aliases
 * on already-known entities. Only attaches to existing entities — never creates
 * new ones from body content alone, which would produce noise from quoted text.
 */
async function enrichContactsFromBody(
  userId: string,
  body: string,
  resolver: EntityResolverService,
): Promise<void> {
  // Work only on the last 800 chars — signatures live at the bottom.
  const tail = body.slice(-800);

  const phones = extractSignaturePhones(tail).slice(0, 3);
  const linkedins = [...new Set((tail.match(LINKEDIN_RE) ?? []).map((u) => u.toLowerCase()))].slice(0, 2);
  const githubs = [...new Set((tail.match(GITHUB_RE) ?? []).map((u) => u.toLowerCase()))].slice(0, 2);
  const bodyEmails = [...new Set((tail.match(EMAIL_IN_BODY_RE) ?? []).map((e) => e.toLowerCase()))].slice(0, 5);

  // For each email found in the signature: if it matches an existing entity,
  // attach any phone/LinkedIn found in the same tail to that entity.
  for (const email of bodyEmails) {
    const entityId = await resolver.lookup(userId, { email }).catch(() => undefined);
    if (!entityId) continue;

    for (const phone of phones) {
      await resolver.attachAlias(userId, entityId, {
        alias: phone.alias,
        normalized: phone.normalized,
        kind: "phone",
        source: "email_body",
        confidence: 0.7,
      }).catch(() => undefined);
    }

    for (const url of [...linkedins, ...githubs]) {
      await resolver.attachAlias(userId, entityId, {
        alias: url,
        normalized: url,
        kind: "url",
        source: "email_body",
        confidence: 0.9,
      }).catch(() => undefined);
    }
  }
}

function extractSignaturePhones(text: string): Array<{ alias: string; normalized: string }> {
  const phones = new Map<string, string>();

  for (const match of text.matchAll(PHONE_RE)) {
    const alias = match[0].trim();
    const digits = alias.replace(/\D/g, "");
    const index = match.index ?? 0;
    if (!isPlausiblePhone(alias, digits, text, index)) continue;
    const normalized = alias.startsWith("+") ? `+${digits}` : digits;
    phones.set(normalized, alias);
  }

  return [...phones.entries()].map(([normalized, alias]) => ({ alias, normalized }));
}

function isPlausiblePhone(
  alias: string,
  digits: string,
  source: string,
  index: number,
): boolean {
  // E.164 max is 15 digits. Longer values are usually order IDs, tracking IDs,
  // verification artifacts, or encoded timestamps, not phone numbers.
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const context = source.slice(
    Math.max(0, index - 32),
    Math.min(source.length, index + alias.length + 32),
  );
  const hasPhoneLabel = PHONE_CONTEXT_RE.test(context);
  const hasPhoneFormatting = alias.includes("+") || /[\s().-]/.test(alias);

  return hasPhoneLabel || hasPhoneFormatting;
}

function shouldStoreEpisode(message: string): boolean {
  const text = message.trim();
  if (text.length < 12 || text.length > 2_000) return false;
  if (/^(?:yes|no|ok(?:ay)?|approved?|continue|thanks?|hello|hey|hi)[.!\s]*$/i.test(text)) return false;
  // Do not persist likely credentials or payment/authentication material from chat.
  if (/\b(?:password|passcode|otp|api[_ -]?key|secret|private key|access token|bearer|cvv)\b/i.test(text)) return false;
  if (/\b(?:sk|pk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{12,}\b/.test(text)) return false;
  return true;
}
