import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { APPROVAL_STORE, type ApprovalStore } from "./approval-store";
import { AuthRepository } from "./auth/auth.repository";
import {
  CONVERSATION_STORE,
  type ConversationStore,
} from "./conversation-store";
import { GatewayService, upgradeRequiredResult } from "./gateway.service";
import { TelegramService, type TelegramUpdate } from "./telegram.service";
import { env } from "@heyriz/shared/env";
import {
  sendTelegramMessage,
  setTelegramWebhook,
} from "@heyriz/shared/telegram";
import {
  requireInternalSecret,
  safeEqual,
  sanitizeReturnPath,
} from "./internal-auth";
import { RedisThrottlerStorage } from "./throttler-redis.storage";
import { appendActionAudit } from "@heyriz/shared/action-audit";
import {
  GmailPushAuthService,
  type PubSubPushEnvelope,
} from "./gmail-push-auth.service";
import { NotionWebhookAuthService } from "./notion-webhook-auth.service";
import { ShopifyWebhookAuthService } from "./shopify-webhook-auth.service";
import { CalendlyWebhookAuthService } from "./calendly-webhook-auth.service";
import { TypeformWebhookAuthService } from "./typeform-webhook-auth.service";
import { LemonSqueezyWebhookAuthService } from "./lemonsqueezy-webhook-auth.service";
import { DropboxWebhookAuthService } from "./dropbox-webhook-auth.service";
import { FigmaWebhookAuthService } from "./figma-webhook-auth.service";
import { QuickBooksWebhookAuthService } from "./quickbooks-webhook-auth.service";
import { XeroWebhookAuthService } from "./xero-webhook-auth.service";
import { WiseWebhookAuthService } from "./wise-webhook-auth.service";
import { DeelWebhookAuthService } from "./deel-webhook-auth.service";
import { BoxWebhookAuthService } from "./box-webhook-auth.service";
import { StripeWebhookAuthService } from "./stripe-webhook-auth.service";
import { RazorpayWebhookAuthService } from "./razorpay-webhook-auth.service";
import { PayPalWebhookAuthService } from "./paypal-webhook-auth.service";
import { logger } from "@heyriz/shared/logger";

type ProxyPayload = Record<string, unknown>;
type ChatHttpBody = {
  userId?: string;
  message?: string;
  history?: unknown;
  approve?: boolean;
  /** Only ever an opaque id from a prior response — never trust tool/payload from the client. */
  pendingApprovalId?: string;
};
type ChatResult = {
  reply: string;
  error?: string;
  upgradeRequired?: boolean;
  pendingApproval?: {
    tool: string;
    payload: Record<string, unknown>;
    preview: string;
  };
  [key: string]: unknown;
};
type RedirectResponse = {
  redirect(url: string): void;
  status(code: number): {
    json(body: unknown): void;
    send(body: string): void;
  };
};
type SseResponse = {
  writeHead(status: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  end(): void;
  on(event: "close", listener: () => void): void;
};

@Controller()
export class GatewayController {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
    @Inject(TelegramService)
    private readonly telegramService: TelegramService,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
    @Inject(APPROVAL_STORE)
    private readonly approvals: ApprovalStore,
    @Inject(RedisThrottlerStorage)
    private readonly throttlerStorage: RedisThrottlerStorage,
    @Inject(GmailPushAuthService)
    private readonly gmailPushAuth: GmailPushAuthService,
    @Inject(NotionWebhookAuthService)
    private readonly notionWebhookAuth: NotionWebhookAuthService,
    @Inject(ShopifyWebhookAuthService)
    private readonly shopifyWebhookAuth: ShopifyWebhookAuthService,
    @Inject(CalendlyWebhookAuthService)
    private readonly calendlyWebhookAuth: CalendlyWebhookAuthService,
    @Inject(TypeformWebhookAuthService)
    private readonly typeformWebhookAuth: TypeformWebhookAuthService,
    @Inject(LemonSqueezyWebhookAuthService)
    private readonly lemonSqueezyWebhookAuth: LemonSqueezyWebhookAuthService,
    @Inject(DropboxWebhookAuthService)
    private readonly dropboxWebhookAuth: DropboxWebhookAuthService,
    @Inject(FigmaWebhookAuthService)
    private readonly figmaWebhookAuth: FigmaWebhookAuthService,
    @Inject(QuickBooksWebhookAuthService)
    private readonly quickBooksWebhookAuth: QuickBooksWebhookAuthService,
    @Inject(XeroWebhookAuthService)
    private readonly xeroWebhookAuth: XeroWebhookAuthService,
    @Inject(WiseWebhookAuthService)
    private readonly wiseWebhookAuth: WiseWebhookAuthService,
    @Inject(DeelWebhookAuthService)
    private readonly deelWebhookAuth: DeelWebhookAuthService,
    @Inject(BoxWebhookAuthService)
    private readonly boxWebhookAuth: BoxWebhookAuthService,
    @Inject(StripeWebhookAuthService)
    private readonly stripeWebhookAuth: StripeWebhookAuthService,
    @Inject(RazorpayWebhookAuthService)
    private readonly razorpayWebhookAuth: RazorpayWebhookAuthService,
    @Inject(PayPalWebhookAuthService)
    private readonly paypalWebhookAuth: PayPalWebhookAuthService,
  ) {}

  @Post("api/public/rate-limit")
  async publicRateLimit(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: { name?: string; key?: string; limit?: number; windowMs?: number },
  ) {
    this.requireInternal(secret);
    if (!body.name?.match(/^[a-z0-9_-]{1,40}$/) || !body.key) {
      throw new BadRequestException("valid name and key are required");
    }
    const limit = Math.min(100, Math.max(1, Math.trunc(body.limit ?? 5)));
    const windowMs = Math.min(
      24 * 60 * 60_000,
      Math.max(1_000, Math.trunc(body.windowMs ?? 60_000)),
    );
    const record = await this.throttlerStorage.increment(
      body.key.slice(0, 200),
      windowMs,
      limit,
      windowMs,
      `public:${body.name}`,
    );
    return {
      allowed: !record.isBlocked,
      retryAfter: record.isBlocked
        ? record.timeToBlockExpire || record.timeToExpire
        : 0,
    };
  }

  @Post("api/telegram/webhook")
  @HttpCode(200)
  async telegramWebhook(
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() body: TelegramUpdate,
  ) {
    // Never accept an unauthenticated webhook in production: without a configured
    // secret anyone could POST forged Telegram updates. (Polling deployments don't
    // reach this endpoint, so requiring the secret here doesn't affect them.)
    if (env.NODE_ENV === "production" && !env.TELEGRAM_WEBHOOK_SECRET) {
      return { ok: false };
    }
    if (
      env.TELEGRAM_WEBHOOK_SECRET &&
      !safeEqual(secret, env.TELEGRAM_WEBHOOK_SECRET)
    ) {
      return { ok: false };
    }
    await this.telegramService.handleUpdate(body);
    return { ok: true };
  }

  /**
   * Authenticated Google Pub/Sub push endpoint. Returning success means the
   * notification has reached a durable BullMQ queue; downstream processing can
   * then retry independently without asking Pub/Sub to redeliver it.
   */
  @Post("api/gmail/push")
  @HttpCode(200)
  async gmailPushWebhook(
    @Headers("authorization") authorization: string | undefined,
    @Query("token") verificationToken: string | undefined,
    @Body() body: PubSubPushEnvelope,
  ) {
    const notification = await this.gmailPushAuth.verify(
      authorization,
      verificationToken,
      body,
    );
    const result = await this.gatewayService.sendToAiCore<{
      matched: number;
      queued: number;
    }>("gmail.push.enqueue", notification);
    return { ok: true, queued: result.queued };
  }

  @Post("api/telegram/set-webhook")
  setTelegramWebhook(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { url?: string },
  ) {
    this.requireInternal(secret);
    if (!body.url) {
      return { ok: false, error: "url_required" };
    }
    return setTelegramWebhook(body.url);
  }

  @Get("health")
  healthCheck() {
    return this.gatewayService.healthCheck();
  }

  @Post("api/ai/chat")
  async chat(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ChatHttpBody,
  ) {
    this.requireInternal(secret);
    const userId = body.userId;
    if (!userId) throw new BadRequestException("userId is required");
    if (body.approve && !(await this.gatewayService.hasProductAccess(userId))) {
      return upgradeRequiredResult();
    }

    // Approval is resolved server-side by opaque id — a client can never smuggle
    // its own tool/payload in as an "approved" action (see approval-store.ts).
    let approval: { id: string; executionId: string; tool: string; payload: unknown } | undefined;
    if (body.approve && body.pendingApprovalId) {
      const pending = await this.approvals.get(userId, body.pendingApprovalId);
      if (pending) {
        approval = {
          id: pending.id,
          executionId: pending.executionId,
          tool: pending.tool,
          payload: pending.payload,
        };
        await this.approvals.remove(userId, body.pendingApprovalId);
        await appendActionAudit({
          userId,
          event: "approved",
          tool: pending.tool,
          payload: pending.payload,
          approvalId: pending.id,
        }).catch(() => undefined);
      }
      // Missing/expired/forged id: fall through with no approval rather than error,
      // so the agent just treats the message as a normal turn.
    }

    const result = await this.gatewayService.sendChatToAiCore<ChatResult>({
      userId,
      message: body.message,
      history: body.history,
      channel: "web",
      ...(approval ? { approve: true, pendingApproval: approval } : {}),
    });

    if ("pendingApproval" in result && result.pendingApproval) {
      const record = await this.approvals.add(userId, result.pendingApproval);
      return {
        ...result,
        pendingApproval: { id: record.id, preview: record.preview },
      };
    }
    return result;
  }

  /**
   * Same turn as api/ai/chat, but each reasoning/tool step streams down as its
   * own SSE frame before the final one — the web dashboard chat's live
   * "what I'm doing" trace. Telegram/Slack are unaffected; they still call
   * api/ai/chat via sendChatToAiCore.
   */
  @Post("api/ai/chat/stream")
  async chatStream(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ChatHttpBody,
    @Res() res: SseResponse,
  ): Promise<void> {
    this.requireInternal(secret);
    const userId = body.userId;
    if (!userId) throw new BadRequestException("userId is required");

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    const send = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (body.approve && !(await this.gatewayService.hasProductAccess(userId))) {
      send({ type: "final", result: upgradeRequiredResult() });
      res.end();
      return;
    }

    let approval: { id: string; executionId: string; tool: string; payload: unknown } | undefined;
    if (body.approve && body.pendingApprovalId) {
      const pending = await this.approvals.get(userId, body.pendingApprovalId);
      if (pending) {
        approval = { id: pending.id, executionId: pending.executionId, tool: pending.tool, payload: pending.payload };
        await this.approvals.remove(userId, body.pendingApprovalId);
        await appendActionAudit({
          userId,
          event: "approved",
          tool: pending.tool,
          payload: pending.payload,
          approvalId: pending.id,
        }).catch(() => undefined);
      }
    }

    const subscription = this.gatewayService
      .streamChatFromAiCore({
        userId,
        message: body.message,
        history: body.history,
        channel: "web",
        ...(approval ? { approve: true, pendingApproval: approval } : {}),
      })
      .subscribe({
        next: async (event) => {
          if (event.type === "final") {
            const result = event.result;
            if (result.pendingApproval) {
              const record = await this.approvals.add(
                userId,
                result.pendingApproval as {
                  tool: string;
                  payload: Record<string, unknown>;
                  preview: string;
                },
              );
              send({
                type: "final",
                result: {
                  ...result,
                  pendingApproval: { id: record.id, preview: record.preview },
                },
              });
              return;
            }
            send({ type: "final", result });
            return;
          }
          send(event);
        },
        error: (error: unknown) => {
          send({
            type: "final",
            result: {
              reply: "Sorry, that took too long or hit an error. Try again?",
              error: error instanceof Error ? error.message : String(error),
            },
          });
          res.end();
        },
        complete: () => res.end(),
      });

    res.on("close", () => subscription.unsubscribe());
  }

  @Post("api/tasks/:id/done")
  @HttpCode(200)
  markTaskDone(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("id") id: string,
    @Body() body: { userId?: string },
  ) {
    this.requireInternal(secret);
    if (!body.userId) throw new BadRequestException("userId is required");
    return this.gatewayService.sendToAiCore("task.markDone", {
      id,
      userId: body.userId,
    });
  }

  @Delete("api/reminders/:id")
  @HttpCode(200)
  cancelReminder(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) throw new BadRequestException("userId is required");
    return this.gatewayService.sendToAiCore("reminder.cancel", { id, userId });
  }

  @Post("api/tasks/reminders")
  @HttpCode(202)
  async scheduleReminder(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    const reminder = await this.gatewayService.sendToAiCore(
      "reminder.schedule",
      body,
    );

    return { reminder };
  }

  @Post("api/emails/:messageId/draft-reply")
  draftEmailReply(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("messageId") messageId: string,
    @Body() body: { userId?: string; instructions?: string },
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("email.draftReply", {
      ...body,
      messageId,
    });
  }

  @Post("api/events")
  ingestEvent(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("event.ingest", body);
  }

  @Post("api/proactive/brief")
  proactiveBrief(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("proactive.brief", body);
  }

  @Post("api/proactive/sync")
  proactiveSync(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("proactive.sync", body);
  }

  @Get("api/preferences")
  getUserPreferences(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("user.preferences.get", { userId });
  }

  @Post("api/preferences/avatar")
  @HttpCode(200)
  setUserAvatar(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("user.avatar.set", body);
  }

  @Post("api/tools/execute")
  executeTool(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("tool.execute", {
      userId: body.userId,
      name: body.name,
      payload: body.payload,
      source: body.source,
    });
  }

  @Post("api/memory")
  remember(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("memory.remember", body);
  }

  @Get("api/memory")
  listMemories(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limit?: string,
  ) {
    this.requireInternal(secret);
    if (!userId) throw new BadRequestException("userId is required");
    return this.gatewayService.sendToAiCore("memory.list", {
      userId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete("api/memory/:id")
  forgetMemory(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) throw new BadRequestException("userId is required");
    return this.gatewayService.sendToAiCore("memory.forget", { userId, id });
  }

  @Delete("api/memory")
  forgetAllMemories(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) throw new BadRequestException("userId is required");
    return this.gatewayService.sendToAiCore("memory.forgetAll", { userId });
  }

  @Post("api/push/subscribe")
  async pushSubscribe(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      userId?: string;
      subscription?: {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
    },
  ) {
    this.requireInternal(secret);
    const sub = body.subscription;
    if (!body.userId || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
      return { ok: false, error: "invalid_subscription" };
    }
    await this.authRepo.savePushSubscription(body.userId, {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return { ok: true };
  }

  @Post("api/push/unsubscribe")
  async pushUnsubscribe(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { endpoint?: string },
  ) {
    this.requireInternal(secret);
    if (!body.endpoint) return { ok: false, error: "endpoint_required" };
    await this.authRepo.deletePushSubscription(body.endpoint);
    return { ok: true };
  }

  @Get("api/push/subscriptions")
  async pushSubscriptions(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { subscriptions: [] };
    return { subscriptions: await this.authRepo.getPushSubscriptions(userId) };
  }

  @Get("api/telegram/resolve")
  async resolveTelegramChatId(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { chatId: null };
    const chatId = await this.authRepo.findTelegramChatIdByUserId(userId);
    return { chatId: chatId ?? null };
  }

  /** Cal.com event types, for the flow-builder's "Create Booking" config dropdown. */
  @Get("api/automations/calcom/event-types")
  async automationCalcomEventTypes(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { connected: false, eventTypes: [] };
    return this.gatewayService.sendToAiCore("automation.calcom.eventTypes", {
      userId,
    });
  }

  /** Slack analog of resolveTelegramChatId — used by the automation-run worker's Slack action. */
  @Get("api/slack/resolve")
  async resolveSlackTarget(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { channel: null, botToken: null };
    const link = await this.authRepo.findSlackLinkByUserId(userId);
    if (!link?.dmChannelId) return { channel: null, botToken: null };
    const teamId = link.slackKey.split(":")[0];
    const botToken = await this.authRepo.findSlackBotTokenByTeam(teamId);
    return { channel: link.dmChannelId, botToken: botToken ?? null };
  }

  @Get("api/telegram/history")
  async telegramHistory(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { error: "userId is required" };

    const link = await this.authRepo.findTelegramLinkByUserId(userId);
    if (!link) return { linked: false, turns: [] };

    const turns = await this.conversations.get(link.chatId);
    return { linked: true, turns, displayName: link.displayName };
  }

  @Get("api/notifications")
  listNotifications(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limit?: string,
  ) {
    this.requireInternal(secret);
    if (!userId) return { entries: [] };
    return this.gatewayService.sendToAiCore("notification.list", {
      userId,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Post("api/notifications/log")
  logNotification(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      userId?: string;
      message?: string;
      source?: string;
      sentAt?: string;
    },
  ) {
    this.requireInternal(secret);
    if (!body.userId || !body.message)
      return { ok: false, error: "userId and message required" };
    return this.gatewayService.sendToAiCore("notification.log", {
      userId: body.userId,
      message: body.message,
      source: body.source ?? "system",
      sentAt: body.sentAt ?? new Date().toISOString(),
    });
  }

  @Get("api/scheduled")
  listScheduled(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("scheduled.list", { userId });
  }

  @Get("api/emails/inbox")
  listInboxEmails(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
    @Query("maxResults") maxResults = "20",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("gmail.listRecent", {
      userId,
      maxResults: parseInt(maxResults, 10) || 20,
    });
  }

  @Get("api/people")
  listPeople(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
    @Query("limit") limit = "50",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("entity.list", {
      userId,
      limit: parseInt(limit, 10) || 50,
    });
  }

  @Get("api/chat/history")
  listChatHistory(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
    @Query("limit") limit = "50",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("chat.listMemories", {
      userId,
      limit: parseInt(limit, 10) || 50,
    });
  }

  @Get("api/emails/processed")
  listProcessedEmails(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
    @Query("limit") limit = "50",
    @Query("includeLowValue") includeLowValue = "false",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("gmail.listEmailMemories", {
      userId,
      limit: parseInt(limit, 10) || 50,
      includeLowValue: includeLowValue === "true",
    });
  }

  // Must stay registered after the literal "api/emails/inbox" and
  // "api/emails/processed" GET routes above, or this param route would
  // shadow them (Express matches same-method routes in registration order).
  @Get("api/emails/:messageId")
  getEmailMessage(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("messageId") messageId: string,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("gmail.getMessage", {
      userId,
      messageId,
    });
  }

  @Get("api/usage")
  getUsage(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("usage.get", { userId });
  }

  /**
   * Daily admin digest: cross-user AI spend, sent to the first ADMIN_EMAILS
   * entry's linked Telegram chat. The worker's scheduler cron hits this once
   * a day — see scheduler.service.ts's "admin-usage-digest" job.
   */
  @Post("api/admin/usage-digest")
  async sendAdminUsageDigest(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
  ) {
    this.requireInternal(secret);

    const adminEmail = (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)[0];
    if (!adminEmail)
      return { ok: false, reason: "ADMIN_EMAILS not configured" };

    const chatId = await this.authRepo.findTelegramChatIdByUserId(adminEmail);
    if (!chatId)
      return { ok: false, reason: "admin has no linked Telegram chat" };

    const summary = await this.gatewayService.sendToAiCore<{
      sinceDays: number;
      users: Array<{
        userId: string;
        calls: number;
        spendUsd: number;
        credits: number;
      }>;
    }>("usage.listAll", { sinceDays: 1 });

    const text = renderAdminUsageDigest(summary);
    const sent = await sendTelegramMessage({ chatId, text });
    return { ok: sent };
  }

  @Get("api/connectors")
  listConnectors(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("connector.list", { userId });
  }

  @Post("api/connectors")
  saveConnector(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("connector.save", body);
  }

  @Delete("api/connectors/account/:id")
  async deleteConnectorById(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("id") id: string,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    const result = await this.gatewayService.sendToAiCore<{
      ok: boolean;
      provider?: string;
    }>("connector.deleteById", { userId, id });
    // Removing the Telegram connector must also release the chat claim, or no
    // other account (including this one, re-onboarding) can ever link that chat.
    if (result?.ok && result.provider === "telegram") {
      await this.authRepo.unlinkTelegramChat(userId);
    }
    return result;
  }

  @Patch("api/connectors/account/:id")
  updateConnectorMetadata(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("id") id: string,
    @Query("userId") userId = "default",
    @Body() body: { metadata?: Record<string, unknown> },
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("connector.updateMetadata", {
      userId,
      id,
      metadata: body.metadata ?? {},
    });
  }

  @Get("api/connectors/notification-check")
  checkConnectorNotification(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("provider") provider: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId || !provider) return { enabled: true };
    return this.gatewayService.sendToAiCore("connector.notification.check", {
      userId,
      provider,
    });
  }

  @Delete("api/connectors/:provider")
  async deleteConnector(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("provider") provider: string,
    @Query("userId") userId = "default",
  ) {
    this.requireInternal(secret);
    // Disconnecting Telegram must also release the chat claim, or no other
    // account (including this one, re-onboarding) can ever link that chat.
    if (provider === "telegram") {
      await this.authRepo.unlinkTelegramChat(userId);
    }
    return this.gatewayService.sendToAiCore("connector.delete", {
      userId,
      provider,
    });
  }

  @Get("api/connectors/:provider/start")
  async startConnectorOAuth(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("provider") provider: string,
    @Query("userId") userId = "default",
    @Query("returnTo") returnTo: string | undefined,
    @Query("region") region: string | undefined,
    @Query("scopeProfile") scopeProfile: string | undefined,
    @Query("shopDomain") shopDomain: string | undefined,
    @Query("teamId") teamId: string | undefined,
    @Query("folderId") folderId: string | undefined,
  ) {
    this.requireInternal(secret);
    const oauthProvider = this.requireConnectorOAuthProvider(provider);
    return this.gatewayService.sendToAiCore<{
      status: string;
      authUrl?: string;
      message?: string;
    }>("connector.oauth.start", {
      userId,
      provider: oauthProvider,
      returnTo,
      calComRegion: region === "eu" ? "eu" : undefined,
      scopeProfile: scopeProfile === "automation" ? "automation" : undefined,
      shopDomain,
      teamId,
      folderId,
    });
  }

  @Post("api/connectors/:provider/start")
  async startConnectorOAuthWithCredentials(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("provider") provider: string,
    @Query("userId") userId = "default",
    @Query("returnTo") returnTo: string | undefined,
    @Body() body: { clientId?: string; clientSecret?: string },
  ) {
    this.requireInternal(secret);
    const oauthProvider = this.requireConnectorOAuthProvider(provider);
    if (oauthProvider !== "calcom") {
      throw new BadRequestException(
        `Custom OAuth credentials are not supported for ${provider}`,
      );
    }
    return this.gatewayService.sendToAiCore<{
      status: string;
      authUrl?: string;
      message?: string;
    }>("connector.oauth.start", {
      userId,
      provider: oauthProvider,
      returnTo,
      calComClientId: body.clientId,
      calComClientSecret: body.clientSecret,
    });
  }

  // Google redirects here for both Google connector flows. The provider is
  // recovered ai-core-side from the signed OAuth state.
  @Get("api/connectors/google/callback")
  async completeGoogleConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Google OAuth code");
      return;
    }

    let result: { returnTo?: string; provider?: string };
    try {
      result = await this.gatewayService.sendToAiCore<{
        returnTo?: string;
        provider?: string;
      }>("connector.oauth.complete", { code, state });
    } catch {
      // Completion can legitimately fail when the callback is replayed (single-
      // use state/code already consumed) or the state expired. That's not a 500
      // — send the user back to connectors with a friendly note to retry.
      res.redirect(
        `${env.WEB_APP_URL}/dashboard/connectors?error=${encodeURIComponent(
          "Couldn't finish connecting your account — please try again.",
        )}`,
      );
      return;
    }

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "google"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/calcom/callback")
  async completeCalComConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Cal.com OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "calcom"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/airtable/callback")
  async completeAirtableConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Airtable OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "airtable"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/notion/callback")
  async completeNotionConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Notion OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "notion"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  /**
   * Notion's own event push — separate from the OAuth callback above. Handles
   * both the one-time verification handshake and every signed event after
   * it (see NotionWebhookAuthService); always 200s so Notion never retries a
   * request we've already understood, including ones we deliberately drop.
   */
  @Post("api/connectors/notion/webhook")
  @HttpCode(200)
  async notionWebhook(
    @Headers("x-notion-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const event = await this.notionWebhookAuth.handle(request.rawBody, signature);
    if (event) {
      this.gatewayService.sendToAiCore("connector.notion.webhook", { event }).catch((error) => {
        logger.warn("notion webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** Shopify order/inventory pushes. See ShopifyWebhookAuthService for the HMAC check. */
  @Post("api/connectors/shopify/webhook")
  @HttpCode(200)
  async shopifyWebhook(
    @Headers("x-shopify-hmac-sha256") hmac: string | undefined,
    @Headers("x-shopify-shop-domain") shopDomain: string | undefined,
    @Headers("x-shopify-topic") topic: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody || !shopDomain || !topic) return { ok: true };
    if (!this.shopifyWebhookAuth.verify(request.rawBody, hmac)) return { ok: true };

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(request.rawBody.toString("utf8"));
    } catch {
      return { ok: true };
    }
    this.gatewayService.sendToAiCore("connector.shopify.webhook", { topic, shopDomain, payload }).catch((error) => {
      logger.warn("shopify webhook forward to ai-core failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return { ok: true };
  }

  /** Calendly booking created/cancelled pushes. See CalendlyWebhookAuthService. */
  @Post("api/connectors/calendly/webhook")
  @HttpCode(200)
  async calendlyWebhook(
    @Headers("calendly-webhook-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const body = await this.calendlyWebhookAuth.handle(request.rawBody, signature);
    if (body) {
      const event = typeof body.event === "string" ? body.event : "";
      const payload = (body.payload as Record<string, unknown> | undefined) ?? {};
      this.gatewayService.sendToAiCore("connector.calendly.webhook", { event, payload }).catch((error) => {
        logger.warn("calendly webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** Typeform "New Submission" pushes. See TypeformWebhookAuthService. */
  @Post("api/connectors/typeform/webhook")
  @HttpCode(200)
  async typeformWebhook(
    @Headers("typeform-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const body = await this.typeformWebhookAuth.handle(request.rawBody, signature);
    if (body) {
      const formResponse = (body.form_response as Record<string, unknown> | undefined) ?? {};
      this.gatewayService.sendToAiCore("connector.typeform.webhook", { formResponse }).catch((error) => {
        logger.warn("typeform webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /**
   * Gumroad "New Sale" pings — unsigned by design. ai-core is the one that
   * confirms seller_id matches a connected account before dispatching, so
   * this just forwards the parsed body; @Body() works here because Gumroad
   * posts application/x-www-form-urlencoded, which Nest's default body
   * parser still decodes into a plain object.
   */
  @Post("api/connectors/gumroad/webhook")
  @HttpCode(200)
  async gumroadWebhook(@Body() body: Record<string, unknown>): Promise<{ ok: true }> {
    this.gatewayService.sendToAiCore("connector.gumroad.webhook", body).catch((error) => {
      logger.warn("gumroad webhook forward to ai-core failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return { ok: true };
  }

  /** Lemon Squeezy "New Sale" pushes. See LemonSqueezyWebhookAuthService. */
  @Post("api/connectors/lemonsqueezy/webhook")
  @HttpCode(200)
  async lemonSqueezyWebhook(
    @Headers("x-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.lemonSqueezyWebhookAuth.handle(request.rawBody, signature);
    if (result) {
      this.gatewayService
        .sendToAiCore("connector.lemonsqueezy.webhook", { storeId: result.storeId, payload: result.body })
        .catch((error) => {
          logger.warn("lemon squeezy webhook forward to ai-core failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
    return { ok: true };
  }

  /**
   * Dropbox's webhook lifecycle also has two phases, like Notion's, but the
   * verification step is a plain GET echo instead of a manual dashboard
   * paste: Dropbox calls this with ?challenge=X once at registration and the
   * response body must be that exact string, verbatim, with no wrapping.
   */
  @Get("api/connectors/dropbox/webhook")
  dropboxWebhookChallenge(
    @Query("challenge") challenge: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    res.status(200).send(challenge ?? "");
  }

  @Post("api/connectors/dropbox/webhook")
  @HttpCode(200)
  async dropboxWebhook(
    @Headers("x-dropbox-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody || !this.dropboxWebhookAuth.verify(request.rawBody, signature)) {
      return { ok: true };
    }
    let body: { list_folder?: { accounts?: string[] } };
    try {
      body = JSON.parse(request.rawBody.toString("utf8"));
    } catch {
      return { ok: true };
    }
    const accountIds = body.list_folder?.accounts ?? [];
    if (accountIds.length > 0) {
      this.gatewayService.sendToAiCore("connector.dropbox.webhook", { accountIds }).catch((error) => {
        logger.warn("dropbox webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** Figma "New Comment" pushes. See FigmaWebhookAuthService. */
  @Post("api/connectors/figma/webhook")
  @HttpCode(200)
  async figmaWebhook(
    @Headers("x-figma-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.figmaWebhookAuth.handle(request.rawBody, signature);
    if (result) {
      this.gatewayService
        .sendToAiCore("connector.figma.webhook", { teamId: result.teamId, payload: result.body })
        .catch((error) => {
          logger.warn("figma webhook forward to ai-core failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
    return { ok: true };
  }

  /**
   * QuickBooks (Intuit) webhook — signed with the app-level verifier token
   * (INTUIT_WEBHOOK_VERIFIER_TOKEN), not a per-connection secret. See
   * QuickBooksWebhookAuthService.
   */
  @Post("api/connectors/quickbooks/webhook")
  @HttpCode(200)
  async quickBooksWebhook(
    @Headers("intuit-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody || !this.quickBooksWebhookAuth.verify(request.rawBody, signature)) {
      return { ok: true };
    }
    let body: {
      eventNotifications?: Array<{
        realmId?: string;
        dataChangeEvent?: { entities?: Array<{ name?: string; id?: string; operation?: string }> };
      }>;
    };
    try {
      body = JSON.parse(request.rawBody.toString("utf8"));
    } catch {
      return { ok: true };
    }
    this.gatewayService
      .sendToAiCore("connector.quickbooks.webhook", { notifications: body.eventNotifications ?? [] })
      .catch((error) => {
        logger.warn("quickbooks webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  /**
   * Xero webhook — both the "intent to receive" handshake ping (empty
   * events[]) and real events land here; XeroWebhookAuthService enforces the
   * 401-on-bad-signature rule the handshake specifically requires.
   */
  @Post("api/connectors/xero/webhook")
  @HttpCode(200)
  async xeroWebhook(
    @Headers("x-xero-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
    @Res() res: RedirectResponse,
  ): Promise<void> {
    if (!request.rawBody) {
      res.status(401).send("");
      return;
    }
    const body = this.xeroWebhookAuth.verify(request.rawBody, signature);
    if (!body) {
      res.status(401).send("");
      return;
    }
    const events = (body.events as Array<Record<string, unknown>> | undefined) ?? [];
    if (events.length > 0) {
      this.gatewayService.sendToAiCore("connector.xero.webhook", { events }).catch((error) => {
        logger.warn("xero webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    res.status(200).send("");
  }

  /** Wise "New Transaction" pushes. See WiseWebhookAuthService (RSA, not HMAC). */
  @Post("api/connectors/wise/webhook")
  @HttpCode(200)
  async wiseWebhook(
    @Headers("x-signature-sha256") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody || !(await this.wiseWebhookAuth.verify(request.rawBody, signature))) {
      return { ok: true };
    }
    let body: { data?: { resource?: { profile_id?: number; account_id?: number } }; event_type?: string };
    try {
      body = JSON.parse(request.rawBody.toString("utf8"));
    } catch {
      return { ok: true };
    }
    if (body.event_type !== "balances#credit") return { ok: true };
    this.gatewayService
      .sendToAiCore("connector.wise.webhook", {
        profileId: body.data?.resource?.profile_id != null ? String(body.data.resource.profile_id) : undefined,
        payload: body,
      })
      .catch((error) => {
        logger.warn("wise webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  @Post("api/connectors/deel/webhook")
  @HttpCode(200)
  async deelWebhook(
    @Headers("x-deel-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    let body: { event?: string; data?: Record<string, unknown>; meta?: { organization_id?: string } };
    try {
      body = JSON.parse(request.rawBody.toString("utf8"));
    } catch {
      return { ok: true };
    }
    const organizationId = body.meta?.organization_id;
    if (!organizationId || !(await this.deelWebhookAuth.verify(request.rawBody, signature, organizationId))) {
      return { ok: true };
    }
    this.gatewayService
      .sendToAiCore("connector.deel.webhook", { event: body.event, data: body.data ?? {}, organizationId })
      .catch((error) => {
        logger.warn("deel webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  /** Box "File Changed" pushes. See BoxWebhookAuthService (two rotating signing keys + replay window). */
  @Post("api/connectors/box/webhook")
  @HttpCode(200)
  async boxWebhook(
    @Headers("box-signature-primary") primarySignature: string | undefined,
    @Headers("box-signature-secondary") secondarySignature: string | undefined,
    @Headers("box-delivery-timestamp") deliveryTimestamp: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.boxWebhookAuth.handle(request.rawBody, primarySignature, secondarySignature, deliveryTimestamp);
    if (result) {
      const trigger = typeof result.body.trigger === "string" ? result.body.trigger : undefined;
      if (trigger === "FILE.UPLOADED") {
        this.gatewayService
          .sendToAiCore("connector.box.webhook", { folderId: result.folderId, payload: result.body })
          .catch((error) => {
            logger.warn("box webhook forward to ai-core failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    }
    return { ok: true };
  }

  /** Stripe "New Payment"/"Failed Charge"/"New Subscription" pushes. See StripeWebhookAuthService (t=/v1= signature, 5-min replay window, per-account or try-all secret resolution). */
  @Post("api/connectors/stripe/webhook")
  @HttpCode(200)
  async stripeWebhook(
    @Headers("stripe-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.stripeWebhookAuth.handle(request.rawBody, signature);
    if (result) {
      this.gatewayService.sendToAiCore("connector.stripe.webhook", result).catch((error) => {
        logger.warn("stripe webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** Razorpay "New Payment"/"Failed Payment" pushes. See RazorpayWebhookAuthService (plain HMAC, try-all secret resolution). */
  @Post("api/connectors/razorpay/webhook")
  @HttpCode(200)
  async razorpayWebhook(
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.razorpayWebhookAuth.handle(request.rawBody, signature);
    if (result) {
      this.gatewayService.sendToAiCore("connector.razorpay.webhook", result).catch((error) => {
        logger.warn("razorpay webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** PayPal "New Payment"/"New Refund" pushes. See PayPalWebhookAuthService (no local HMAC — verified via PayPal's own API, try-all across accounts). */
  @Post("api/connectors/paypal/webhook")
  @HttpCode(200)
  async paypalWebhook(
    @Headers("paypal-auth-algo") authAlgo: string | undefined,
    @Headers("paypal-cert-url") certUrl: string | undefined,
    @Headers("paypal-transmission-id") transmissionId: string | undefined,
    @Headers("paypal-transmission-sig") transmissionSig: string | undefined,
    @Headers("paypal-transmission-time") transmissionTime: string | undefined,
    @Req() request: { rawBody?: Buffer },
  ): Promise<{ ok: true }> {
    if (!request.rawBody) return { ok: true };
    const result = await this.paypalWebhookAuth.handle(request.rawBody, {
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
    });
    if (result) {
      this.gatewayService.sendToAiCore("connector.paypal.webhook", result).catch((error) => {
        logger.warn("paypal webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return { ok: true };
  }

  /** Statuspage "New Incident"/"Incident Update" pushes — no signature support, secret is a query param like UptimeRobot. */
  @Post("api/connectors/statuspage/webhook")
  @HttpCode(200)
  async statuspageWebhook(
    @Query("secret") secret: string | undefined,
    @Body() body: { incident?: { id?: string; status?: string; name?: string } },
  ): Promise<{ ok: true }> {
    if (!secret || !body.incident?.id || !body.incident.status) return { ok: true };
    const userId = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.statuspage.resolveSecret", { secret })
      .catch(() => undefined);
    if (!userId) {
      logger.warn("statuspage webhook: secret did not match a connected account; dropping");
      return { ok: true };
    }
    this.gatewayService
      .sendToAiCore("connector.statuspage.webhook", {
        userId,
        incidentId: body.incident.id,
        status: body.incident.status,
        name: body.incident.name,
      })
      .catch((error) => {
        logger.warn("statuspage webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  /** Better Stack "Incident Started"/"Incident Resolved" pushes — no signature support, secret is a query param like UptimeRobot. */
  @Post("api/connectors/betterstack/webhook")
  @HttpCode(200)
  async betterStackWebhook(
    @Query("secret") secret: string | undefined,
    @Body() body: { incident?: { id?: string; status?: string; name?: string } },
  ): Promise<{ ok: true }> {
    if (!secret || !body.incident?.id || !body.incident.status) return { ok: true };
    const userId = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.betterstack.resolveSecret", { secret })
      .catch(() => undefined);
    if (!userId) {
      logger.warn("betterstack webhook: secret did not match a connected account; dropping");
      return { ok: true };
    }
    this.gatewayService
      .sendToAiCore("connector.betterstack.webhook", {
        userId,
        incidentId: body.incident.id,
        status: body.incident.status,
        name: body.incident.name,
      })
      .catch((error) => {
        logger.warn("betterstack webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  /**
   * UptimeRobot has no HMAC signing at all — the query-param secret the user
   * pastes into their Alert Contact URL is both identity and verification.
   * ai-core resolves it against every connected account's stored
   * webhookSecret (safeEqual) and returns the owning userId, or nothing.
   */
  @Post("api/connectors/uptimerobot/webhook")
  @HttpCode(200)
  async uptimeRobotWebhook(
    @Query("secret") secret: string | undefined,
    @Body()
    body: {
      monitorID?: string;
      monitorFriendlyName?: string;
      alertTypeFriendlyName?: string;
    },
  ): Promise<{ ok: true }> {
    if (!secret || !body.monitorID || !body.alertTypeFriendlyName) return { ok: true };
    const userId = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.uptimerobot.resolveSecret", { secret })
      .catch(() => undefined);
    if (!userId) {
      logger.warn("uptimerobot webhook: secret did not match a connected account; dropping");
      return { ok: true };
    }
    this.gatewayService
      .sendToAiCore("connector.uptimerobot.webhook", {
        userId,
        monitorId: body.monitorID,
        monitorFriendlyName: body.monitorFriendlyName,
        alertTypeFriendlyName: body.alertTypeFriendlyName,
      })
      .catch((error) => {
        logger.warn("uptimerobot webhook forward to ai-core failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return { ok: true };
  }

  @Get("api/connectors/github/callback")
  async completeGitHubConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing GitHub OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "github"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/stripe/callback")
  async completeStripeConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(errorDescription ?? error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Stripe OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "stripe"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/shopify/callback")
  async completeShopifyConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("shop") shop: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (!code || !shop) {
      res.status(400).send("Missing Shopify OAuth code or shop");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "shopify"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/dropbox/callback")
  async completeDropboxConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Dropbox OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "dropbox"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/figma/callback")
  async completeFigmaConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Figma OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "figma"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  /** Intuit returns realmId (the company id) as its own callback query param, separate from code/state. */
  @Get("api/connectors/quickbooks/callback")
  async completeQuickBooksConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("realmId") realmId: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !realmId) {
      res.status(400).send("Missing QuickBooks OAuth code or realmId");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state, realmId });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "quickbooks"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/xero/callback")
  async completeXeroConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Xero OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "xero"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/deel/callback")
  async completeDeelConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Deel OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "deel"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/box/callback")
  async completeBoxConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Box OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "box"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/jira/callback")
  async completeJiraConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Jira OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "jira"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/calendly/callback")
  async completeCalendlyConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing Calendly OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "calendly"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  @Get("api/connectors/pagerduty/callback")
  async completePagerDutyConnectorOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (error) {
      const returnTo = await this.errorReturnTo(state, "/dashboard/connectors");
      const sep = returnTo.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${returnTo}${sep}error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      res.status(400).send("Missing PagerDuty OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "pagerduty"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  private requireConnectorOAuthProvider(
    provider: string,
  ): "gmail" | "calendar" | "calcom" | "notion" | "github" | "stripe" | "shopify" | "dropbox" | "figma" | "quickbooks" | "xero" | "deel" | "box" | "jira" | "calendly" | "airtable" | "pagerduty" {
    if (
      provider === "gmail" ||
      provider === "calendar" ||
      provider === "calcom" ||
      provider === "notion" ||
      provider === "github" ||
      provider === "stripe" ||
      provider === "shopify" ||
      provider === "dropbox" ||
      provider === "figma" ||
      provider === "quickbooks" ||
      provider === "xero" ||
      provider === "deel" ||
      provider === "box" ||
      provider === "jira" ||
      provider === "calendly" ||
      provider === "airtable" ||
      provider === "pagerduty"
    ) {
      return provider;
    }
    throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }

  /**
   * Recovers where an OAuth attempt started (e.g. mid-automation) when the
   * provider redirects back with `?error=...` instead of `?code=...` — the
   * normal completeOAuth path (which reads returnTo off the consumed state)
   * never runs on that branch, so every connector error used to bounce the
   * principal to the generic /dashboard/connectors regardless of where they
   * actually came from. Falls back to `fallback` if there's no state, it's
   * invalid, or ai-core is unreachable.
   */
  private async errorReturnTo(state: string | undefined, fallback: string): Promise<string> {
    if (!state) return fallback;
    try {
      const result = await this.gatewayService.sendToAiCore<{ returnTo?: string }>(
        "connector.oauth.resolveReturnTo",
        { state },
      );
      return sanitizeReturnPath(result.returnTo, fallback);
    } catch {
      return fallback;
    }
  }
}

function renderAdminUsageDigest(summary: {
  sinceDays: number;
  users: Array<{
    userId: string;
    calls: number;
    spendUsd: number;
    credits: number;
  }>;
}): string {
  const users = summary.users;
  if (users.length === 0) {
    return `AI usage digest (last ${summary.sinceDays}d): no activity.`;
  }
  const totalCredits = users.reduce((sum, u) => sum + u.credits, 0);
  const totalCalls = users.reduce((sum, u) => sum + u.calls, 0);
  const lines = users
    .slice(0, 20)
    .map(
      (u) =>
        `${u.userId} — ${u.credits.toLocaleString()} credits (${u.calls} calls)`,
    );
  const more =
    users.length > 20 ? `\n…and ${users.length - 20} more users` : "";
  return (
    [
      `AI usage digest (last ${summary.sinceDays}d)`,
      `${users.length} active users, ${totalCredits.toLocaleString()} credits, ${totalCalls} calls total`,
      "",
      ...lines,
    ].join("\n") + more
  );
}
