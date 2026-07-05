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
  Res,
} from "@nestjs/common";
import { APPROVAL_STORE, type ApprovalStore } from "./approval-store";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore } from "./conversation-store";
import { GatewayService } from "./gateway.service";
import {
  TelegramService,
  type TelegramUpdate,
} from "./telegram.service";
import { env } from "@heyriz/shared/env";
import { setTelegramWebhook } from "@heyriz/shared/telegram";
import { requireInternalSecret, safeEqual, sanitizeReturnPath } from "./internal-auth";

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
  pendingApproval?: { tool: string; payload: Record<string, unknown>; preview: string };
  [key: string]: unknown;
};
type RedirectResponse = {
  redirect(url: string): void;
  status(code: number): {
    json(body: unknown): void;
    send(body: string): void;
  };
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
  ) {}

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
    if (env.TELEGRAM_WEBHOOK_SECRET && !safeEqual(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return { ok: false };
    }
    await this.telegramService.handleUpdate(body);
    return { ok: true };
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

    // Approval is resolved server-side by opaque id — a client can never smuggle
    // its own tool/payload in as an "approved" action (see approval-store.ts).
    let approval: { tool: string; payload: unknown } | undefined;
    if (body.approve && body.pendingApprovalId) {
      const pending = await this.approvals.get(userId, body.pendingApprovalId);
      if (pending) {
        approval = { tool: pending.tool, payload: pending.payload };
        await this.approvals.remove(userId, body.pendingApprovalId);
      }
      // Missing/expired/forged id: fall through with no approval rather than error,
      // so the agent just treats the message as a normal turn.
    }

    const result = await this.gatewayService.sendToAiCore<ChatResult>("chat.message", {
      userId,
      message: body.message,
      history: body.history,
      ...(approval ? { approve: true, pendingApproval: approval } : {}),
    });

    if (result.pendingApproval) {
      const record = await this.approvals.add(userId, result.pendingApproval);
      return { ...result, pendingApproval: { id: record.id, preview: record.preview } };
    }
    return result;
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
    return this.gatewayService.sendToAiCore("task.markDone", { id, userId: body.userId });
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

  @Post("api/emails/schedule")
  @HttpCode(202)
  scheduleOutboundEmail(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("email.scheduleOutbound", body);
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
    return this.gatewayService.sendToAiCore("tool.execute", body);
  }

  @Post("api/memory")
  remember(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: ProxyPayload,
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("memory.remember", body);
  }

  @Post("api/push/subscribe")
  async pushSubscribe(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: {
      userId?: string;
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
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

  @Get("api/telegram/history")
  async telegramHistory(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { error: "userId is required" };

    const chatId = await this.authRepo.findTelegramChatIdByUserId(userId);
    if (!chatId) return { linked: false, turns: [] };

    const turns = await this.conversations.get(chatId);
    return { linked: true, turns };
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
    @Body() body: { userId?: string; message?: string; source?: string; sentAt?: string },
  ) {
    this.requireInternal(secret);
    if (!body.userId || !body.message) return { ok: false, error: "userId and message required" };
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

  @Get("api/emails/processed")
  listProcessedEmails(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId = "default",
    @Query("limit") limit = "50",
  ) {
    this.requireInternal(secret);
    return this.gatewayService.sendToAiCore("gmail.listEmailMemories", {
      userId,
      limit: parseInt(limit, 10) || 50,
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
    const result = await this.gatewayService.sendToAiCore<{ ok: boolean; provider?: string }>(
      "connector.deleteById",
      { userId, id },
    );
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
    return this.gatewayService.sendToAiCore("connector.notification.check", { userId, provider });
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
  async startGoogleOAuth(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Param("provider") provider: string,
    @Query("userId") userId = "default",
    @Query("returnTo") returnTo: string | undefined,
  ) {
    this.requireInternal(secret);
    const googleProvider = this.requireGoogleOAuthProvider(provider);
    return this.gatewayService.sendToAiCore<{
      status: string;
      authUrl?: string;
      message?: string;
    }>("connector.oauth.start", {
      userId,
      provider: googleProvider,
      returnTo,
    });
  }

  // Google redirects here for both flows — there's one OAuth client redirect_uri
  // registered with Google, so the provider can't come from the path. It's
  // recovered ai-core-side from the signed OAuth state instead.
  @Get("api/connectors/google/callback")
  async completeGoogleOAuth(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    if (!code) {
      res.status(400).send("Missing Google OAuth code");
      return;
    }

    const result = await this.gatewayService.sendToAiCore<{
      returnTo?: string;
      provider?: string;
    }>("connector.oauth.complete", { code, state });

    const returnTo = sanitizeReturnPath(
      result.returnTo,
      `/dashboard/connectors?connected=${result.provider ?? "google"}`,
    );
    res.redirect(`${env.WEB_APP_URL}${returnTo}`);
  }

  private requireGoogleOAuthProvider(provider: string): "gmail" | "calendar" {
    if (provider === "gmail" || provider === "calendar") return provider;
    throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }
}
