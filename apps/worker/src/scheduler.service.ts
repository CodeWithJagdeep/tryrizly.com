import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from "@nestjs/microservices";
import { Queue, Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import {
  enqueueNotification,
  getNotificationQueue,
  safeJobId,
} from "@heyriz/shared/queue/queues";
import { enqueueEmailEvent } from "@heyriz/shared/queue/email-events";
import { enqueueAutomationRun } from "@heyriz/shared/queue/automation-runs";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";
import type { AutomationFlow } from "@heyriz/shared/automations/types";
import {
  validateAutomationFlowForActivation,
  validateAutomationReleasePolicy,
} from "@heyriz/shared/automations/schemas";
import {
  selectNewGmailTriggerItems,
  shouldPollAutomationFlow,
  type AutomationPollMode,
} from "./automation-trigger-dedupe";

/**
 * The cron heartbeat. It owns no intelligence: on each tick it asks ai-core to
 * do the thinking (compose the brief / scan the calendar and schedule meeting
 * reminders). Keeping the brain in ai-core and the clock here matches the
 * documented Watch -> ... -> Notify architecture.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  async onModuleInit() {
    const connection = createRedisConnection();
    this.queue = new Queue(queueNames.scheduler, { connection });

    // Morning brief: fire hourly, but ai-core only actually sends to each user
    // when it's MORNING_BRIEF_HOUR in *their* saved timezone — so the brief lands
    // in each principal's own morning, not a single global UTC hour.
    await this.queue.upsertJobScheduler(
      "morning-brief",
      { pattern: `0 * * * *`, tz: "UTC" },
      { name: "morning-brief", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "meeting-sync",
      {
        pattern: `*/${env.MEETING_SYNC_MINUTES} * * * *`,
        tz: env.DEFAULT_TIMEZONE,
      },
      { name: "meeting-sync", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "email-poll",
      {
        pattern: `*/${env.EMAIL_POLL_MINUTES} * * * *`,
        tz: env.DEFAULT_TIMEZONE,
      },
      { name: "email-poll", data: {} },
    );
    // Gmail watches expire within seven days. Renew daily with a generous
    // margin, and reconcile hourly because Google documents that individual
    // push notifications can occasionally be delayed or dropped.
    await this.queue.upsertJobScheduler(
      "gmail-watch-renew",
      { pattern: "17 2 * * *", tz: "UTC" },
      { name: "gmail-watch-renew", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "email-reconcile",
      { pattern: "11 * * * *", tz: "UTC" },
      { name: "email-reconcile", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "automation-poll",
      {
        pattern: `*/${env.AUTOMATION_POLL_MINUTES} * * * *`,
        tz: env.DEFAULT_TIMEZONE,
      },
      { name: "automation-poll", data: {} },
    );
    // Away/Vacation return sweep — every 30 min, deliver the held-email priority
    // digest to anyone whose vacation window just elapsed.
    await this.queue.upsertJobScheduler(
      "away-return",
      { pattern: "*/30 * * * *", tz: env.DEFAULT_TIMEZONE },
      { name: "away-return", data: {} },
    );

    // Weekly business digest (Sunday 9 AM) and daily anomaly scan (2 PM).
    await this.queue.upsertJobScheduler(
      "weekly-digest",
      { pattern: "0 9 * * 0", tz: env.DEFAULT_TIMEZONE },
      { name: "weekly-digest", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "daily-anomaly",
      { pattern: "0 14 * * *", tz: env.DEFAULT_TIMEZONE },
      { name: "daily-anomaly", data: {} },
    );
    // Daily billing sweep at 10 AM: trial nudges + expiry + subscription
    // reconciliation. Scheduler id kept from the old nudge-only job so the
    // stale repeatable job doesn't linger in Redis alongside a new one.
    await this.queue.upsertJobScheduler(
      "trial-expiry-nudge",
      { pattern: "0 10 * * *", tz: env.DEFAULT_TIMEZONE },
      { name: "trial-expiry-nudge", data: {} },
    );
    // Admin-only: daily cross-user AI spend digest, sent to ADMIN_EMAILS's
    // linked Telegram chat (see gateway's api/admin/usage-digest).
    await this.queue.upsertJobScheduler(
      "admin-usage-digest",
      { pattern: "0 8 * * *", tz: env.DEFAULT_TIMEZONE },
      { name: "admin-usage-digest", data: {} },
    );

    const worker = new Worker(
      queueNames.scheduler,
      async (job) => {
        if (job.name === "morning-brief") {
          await this.forEachActiveUser(undefined, async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.briefIfDue", {
                userId,
                briefHour: env.MORNING_BRIEF_HOUR,
              }),
            );
            logger.info("scheduler tick handled", {
              job: job.name,
              userId,
              result,
            });
          });
          return;
        }

        if (job.name === "meeting-sync") {
          await this.forEachActiveUser("calendar", async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.sync", {
                userId,
                source: "calendar",
              }),
            );
            logger.info("scheduler tick handled", {
              job: job.name,
              userId,
              source: "calendar",
              result,
            });
          });
          await this.forEachActiveUser("calcom", async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.sync", { userId, source: "calcom" }),
            );
            logger.info("scheduler tick handled", {
              job: job.name,
              userId,
              source: "calcom",
              result,
            });
          });
          return;
        }

        if (job.name === "email-poll") {
          await this.pollInbox("push-inactive");
          return;
        }

        if (job.name === "gmail-watch-renew") {
          await this.renewGmailWatches();
          return;
        }

        if (job.name === "email-reconcile") {
          await this.pollInbox("push-active");
          await this.pollAutomations({ mode: "reconcile" });
          return;
        }

        if (job.name === "automation-poll") {
          await this.pollAutomations({ mode: "scheduled" });
          return;
        }

        if (job.name === "away-return") {
          await this.sweepAwayReturns();
          return;
        }

        if (job.name === "weekly-digest") {
          await this.forEachActiveUser(undefined, async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.weeklyDigest", { userId }),
            );
            logger.info("scheduler tick handled", {
              job: job.name,
              userId,
              result,
            });
          });
          return;
        }

        if (job.name === "daily-anomaly") {
          await this.forEachActiveUser(undefined, async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.dailyAnomalyCheck", { userId }),
            );
            logger.info("scheduler tick handled", {
              job: job.name,
              userId,
              result,
            });
          });
          return;
        }

        if (job.name === "trial-expiry-nudge") {
          await this.runBillingSweep();
          return;
        }

        if (job.name === "admin-usage-digest") {
          await this.sendAdminUsageDigest();
          return;
        }
      },
      { connection, concurrency: 2 },
    );

    worker.on("failed", (job, error) => {
      captureException(error, { job: job?.name });
      logger.error("scheduler job failed", {
        job: job?.name,
        error: error.message,
      });
    });

    this.worker = worker;

    logger.info("scheduler started", {
      morningBriefHour: env.MORNING_BRIEF_HOUR,
      meetingSyncMinutes: env.MEETING_SYNC_MINUTES,
      emailPollMinutes: env.EMAIL_POLL_MINUTES,
      tz: env.DEFAULT_TIMEZONE,
    });
  }

  /** Asks the gateway to compose and send the daily admin usage digest to Telegram. */
  private async sendAdminUsageDigest() {
    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    const secret = env.AUTH_INTERNAL_SECRET;
    if (!gatewayUrl) return;

    try {
      const headers: Record<string, string> = {};
      if (secret) headers["x-heyriz-internal-secret"] = secret;
      const res = await fetch(`${gatewayUrl}/api/admin/usage-digest`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        logger.warn("admin usage digest request failed", {
          status: res.status,
        });
        return;
      }
      const result = (await res.json()) as { ok?: boolean; reason?: string };
      if (!result.ok) {
        logger.warn("admin usage digest not sent", { reason: result.reason });
      }
    } catch (err) {
      logger.warn("admin usage digest request threw", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * The billing service owns the sweep logic (who to nudge, expiry processing,
   * provider reconciliation — deduped in its own tables); this side owns the
   * clock and the notification queue, so it enqueues whatever the sweep returns.
   */
  private async runBillingSweep() {
    type SweepResult = {
      ok?: boolean;
      nudges?: Array<{
        userId: string;
        kind: string;
        message: string;
        emailFallback?: boolean;
      }>;
      expiredProcessed?: number;
      reconciled?: number;
    };

    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    const secret = env.AUTH_INTERNAL_SECRET;
    if (!gatewayUrl) return;

    let result: SweepResult;
    try {
      const headers: Record<string, string> = {};
      if (secret) headers["x-heyriz-internal-secret"] = secret;
      const res = await fetch(`${gatewayUrl}/api/billing/sweep`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        logger.warn("billing sweep request failed", { status: res.status });
        return;
      }
      result = (await res.json()) as SweepResult;
    } catch (err) {
      logger.warn("billing sweep request threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    for (const nudge of result.nudges ?? []) {
      try {
        await getNotificationQueue().add(
          "telegram-notification",
          {
            userId: nudge.userId,
            message: nudge.message,
            source: "gateway" as const,
            emailFallback: nudge.emailFallback,
          },
          {
            jobId: safeJobId(
              `${nudge.kind}:${nudge.userId}:${new Date().toISOString().slice(0, 10)}`,
            ),
          },
        );
        logger.info("billing nudge enqueued", {
          userId: nudge.userId,
          kind: nudge.kind,
        });
      } catch (err) {
        logger.warn("billing nudge enqueue failed", {
          userId: nudge.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("billing sweep completed", {
      nudges: (result.nudges ?? []).length,
      expiredProcessed: result.expiredProcessed ?? 0,
      reconciled: result.reconciled ?? 0,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.aiCore.close();
  }

  /** Deliver the held-email priority digest to users whose Away window elapsed. */
  private async sweepAwayReturns() {
    let result:
      | { returns?: Array<{ userId: string; message: string }> }
      | undefined;
    try {
      result = await firstValueFrom(
        this.aiCore.send<{
          returns: Array<{ userId: string; message: string }>;
        }>("proactive.away.sweep", {}),
      );
    } catch (error) {
      logger.warn("away-return: ai-core sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    for (const item of result?.returns ?? []) {
      await enqueueNotification({
        userId: item.userId,
        message: item.message,
        source: "ai-core",
      }).catch((error: unknown) =>
        logger.warn("away-return: notify enqueue failed", {
          userId: item.userId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    if ((result?.returns?.length ?? 0) > 0) {
      logger.info("away-return: digests delivered", {
        count: result?.returns?.length,
      });
    }
  }

  private async pollInbox(mode: "push-active" | "push-inactive") {
    type InboxResult = {
      connected: boolean;
      messages: Array<{
        id: string;
        threadId: string;
        from: string;
        subject: string;
        snippet: string;
      }>;
    };

    await this.forEachActiveUser("gmail", async (userId) => {
      const push = await firstValueFrom(
        this.aiCore.send<{ configured: boolean; active: boolean }>(
          "gmail.push.status",
          { userId },
        ),
      ).catch(() => ({ configured: false, active: false }));
      if (
        (mode === "push-active" && !push.active) ||
        (mode === "push-inactive" && push.active)
      ) {
        return;
      }

      // Respect the connectors-page "Auto-process emails" toggle. When it's off,
      // Riz must not read or AI-summarise the inbox at all — we skip the whole
      // poll for this user, not just suppress the Telegram notification later.
      const gate = await firstValueFrom(
        this.aiCore.send<{ enabled: boolean }>("connector.autoprocess.check", {
          userId,
          provider: "gmail",
        }),
      ).catch(() => ({ enabled: true }));
      if (!gate.enabled) {
        logger.info("email poll: auto-process disabled, skipping", { userId });
        return;
      }

      let result: InboxResult | undefined;
      try {
        result = await firstValueFrom(
          this.aiCore.send<InboxResult>("gmail.listRecent", {
            userId,
            maxResults: mode === "push-active" ? 100 : 25,
          }),
        );
      } catch (error) {
        logger.warn("email poll: ai-core call failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      if (!result?.connected || !result.messages?.length) {
        logger.info("email poll: inbox empty or not connected", { userId });
        return;
      }

      for (const msg of result.messages) {
        await enqueueEmailEvent({
          userId,
          messageId: msg.id,
          threadId: msg.threadId,
          from: msg.from,
          subject: msg.subject,
          snippet: msg.snippet,
          source: "poll",
        }).catch((error: unknown) => {
          logger.warn("email poll: enqueue failed", {
            userId,
            messageId: msg.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      logger.info("email poll: enqueued", {
        userId,
        count: result.messages.length,
      });
    });
  }

  private async renewGmailWatches() {
    await this.forEachActiveUser("gmail", async (userId) => {
      const result = await firstValueFrom(
        this.aiCore.send("gmail.watch.renew", { userId }),
      );
      logger.info("gmail watch renewal handled", { userId, result });
    });
  }

  /**
   * v1 automation trigger poller: schedule/gmail/calendar only (see
   * @heyriz/shared/automations/types LIVE_TRIGGER_EVENTS). Reads active flows
   * from the gateway (it owns automation_flows/automation_runs in Mongo — the
   * worker never opens its own client for gateway-owned collections, same
   * convention as the billing sweep below), fires a de-duped automation-run
   * job per new trigger item, and writes the advanced cursor back.
   */
  /** Called by the authenticated Gmail Pub/Sub worker after it advances the
   * mailbox history cursor. The Gmail API still evaluates each automation's
   * exact search query; Pub/Sub is the wake-up signal, not the policy engine. */
  async dispatchGmailAutomationsFromPush(userId: string): Promise<void> {
    await this.pollAutomations({ mode: "gmail-push", userId });
  }

  private async pollAutomations(options: {
    mode: AutomationPollMode;
    userId?: string;
  }) {
    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    const secret = env.AUTH_INTERNAL_SECRET;
    if (!gatewayUrl) return;
    const headers: Record<string, string> = {};
    if (secret) headers["x-heyriz-internal-secret"] = secret;

    let flows: AutomationFlow[];
    try {
      const res = await fetch(
        `${gatewayUrl}/api/automations/_internal/active`,
        { headers },
      );
      if (!res.ok) {
        logger.warn("automation poll: active-flow fetch failed", {
          status: res.status,
        });
        return;
      }
      const data = (await res.json()) as { flows?: AutomationFlow[] };
      flows = (data.flows ?? []).filter(
        (flow) => !options.userId || flow.userId === options.userId,
      );
    } catch (error) {
      logger.warn("automation poll: active-flow fetch threw", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const pushStatusByUser = new Map<string, boolean>();
    const pushActive = async (userId: string) => {
      const cached = pushStatusByUser.get(userId);
      if (cached !== undefined) return cached;
      const status = await firstValueFrom(
        this.aiCore.send<{ configured: boolean; active: boolean }>(
          "gmail.push.status",
          { userId },
        ),
      ).catch(() => ({ configured: false, active: false }));
      const active = status.configured && status.active;
      pushStatusByUser.set(userId, active);
      return active;
    };

    for (const flow of flows) {
      const triggerApp = flow.steps[0]?.app ?? "";
      const gmailPushActive =
        triggerApp === "gmail" && options.mode !== "gmail-push"
          ? await pushActive(flow.userId)
          : false;
      if (!shouldPollAutomationFlow({
        mode: options.mode,
        triggerApp,
        gmailPushActive,
      })) {
        continue;
      }
      try {
        await this.pollOneAutomation(flow, gatewayUrl, headers);
      } catch (error) {
        logger.warn("automation poll: flow failed", {
          flowId: flow.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async pollOneAutomation(
    flow: AutomationFlow,
    gatewayUrl: string,
    headers: Record<string, string>,
  ) {
    const validation = validateAutomationFlowForActivation(flow);
    if (!validation.ok) {
      logger.error("automation poll: active flow failed runtime validation", {
        flowId: flow.id,
        issues: validation.issues.slice(0, 5),
      });
      return;
    }
    const release = validateAutomationReleasePolicy(
      flow,
      env.AUTOMATION_RELEASE_TIER,
    );
    if (!release.ok) {
      logger.error("automation poll: active flow is outside release tier", {
        flowId: flow.id,
        tier: env.AUTOMATION_RELEASE_TIER,
        issues: release.issues.slice(0, 5),
      });
      return;
    }
    const trigger = flow.steps[0];
    if (!trigger) return;
    const seen = new Set(flow.cursor?.seenIds ?? []);
    const now = new Date();
    let newItems: { itemId: string; payload: Record<string, unknown> }[] = [];
    let cursorNeedsUpdate = false;

    if (trigger.app === "schedule") {
      const everyMinutes = Number(trigger.config?.everyMinutes) || 60;
      const lastPolledAt = flow.cursor?.lastPolledAt
        ? new Date(flow.cursor.lastPolledAt)
        : undefined;
      const due =
        !lastPolledAt ||
        now.getTime() - lastPolledAt.getTime() >= everyMinutes * 60_000;
      if (due) {
        newItems = [
          {
            itemId: now.toISOString(),
            payload: { firedAt: now.toISOString() },
          },
        ];
      }
    } else if (trigger.app === "gmail") {
      // "New Email Matching Search"/"New Label"/"New Labeled Email"/
      // "New Labeled Conversation" all require the user's own Gmail search
      // string (config.query, the same "Advanced" field the flow-builder's
      // gmail config panel exposes for every gmail trigger) — there's no
      // dedicated "label" picker field, so label-scoped variants are
      // configured the same way ("label:SomeName ..."). "New Label" in
      // particular only detects messages matching that query that we haven't
      // seen yet, NOT a genuine "label object was just created" event — Gmail
      // has no cheap endpoint to poll for that, so this is an approximation.
      const configuredQuery = String(trigger.config?.query ?? "").trim();
      const defaultQueryByTitle: Record<string, string> = {
        "New Email": "in:inbox newer_than:14d",
        "New Attachment": "has:attachment newer_than:14d",
        "New Starred Email": "is:starred newer_than:2d",
        "New Conversation": "in:inbox newer_than:14d",
      };
      const query = configuredQuery || defaultQueryByTitle[trigger.title] || "";
      if (!query) return;
      // Which connected Gmail account this trigger targets (multi-account) — the
      // flow-builder stores the chosen connector row id in the step config.
      const accountId =
        String(trigger.config?.account ?? "").trim() || undefined;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          messages: Array<{
            id: string;
            threadId: string;
            from: string;
            subject: string;
            snippet: string;
            internalDate?: string;
          }>;
        }>("automation.gmail.search", {
          userId: flow.userId,
          query,
          maxResults: 10,
          accountId,
        }),
      );
      if (!result?.connected) return;
      const rawMessages = result.messages ?? [];
      // "New Conversation"/"New Labeled Conversation" fire once per thread
      // (the first time we see it), not once per message — approximate,
      // since a thread that already had messages outside our search window
      // before activation still looks "new" the first time it's matched.
      const dedupeOnThread =
        trigger.title === "New Conversation" ||
        trigger.title === "New Labeled Conversation";
      const selection = selectNewGmailTriggerItems<{ id: string; internalDate?: string }>(
        dedupeOnThread
          ? rawMessages.map((m) => ({ id: m.threadId, internalDate: m.internalDate }))
          : rawMessages,
        flow.cursor,
        flow.updatedAt,
      );
      if (dedupeOnThread) {
        const newThreadIds = new Set(selection.newItems.map((m) => m.id));
        const seenThreadIds = new Set<string>();
        newItems = rawMessages
          .filter((m) => newThreadIds.has(m.threadId) && !seenThreadIds.has(m.threadId))
          .map((m) => {
            seenThreadIds.add(m.threadId);
            return { itemId: m.threadId, payload: { ...m } };
          });
      } else {
        newItems = selection.newItems.map((m) => ({ itemId: m.id, payload: { ...m } }));
      }
      if (selection.baselineEstablished) {
        for (const id of selection.seenIds) seen.add(id);
        cursorNeedsUpdate = true;
        logger.info("automation poll: Gmail baseline established", {
          flowId: flow.id,
          existingMatches: selection.seenIds.length,
        });
      }
    } else if (trigger.app === "calendar" && trigger.title === "Event Start") {
      // A tight forward window, mirroring the "google-meet" Meet-link poller
      // below — "about to start" means it falls inside whichever poll window
      // catches its start time.
      const timeMin = now.toISOString();
      const timeMax = new Date(
        now.getTime() + env.AUTOMATION_POLL_MINUTES * 60_000,
      ).toISOString();
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          events: Array<{ id: string; summary?: string; start?: unknown; end?: unknown }>;
        }>("automation.calendar.list", {
          userId: flow.userId,
          timeMin,
          timeMax,
          maxResults: 25,
        }),
      );
      if (!result?.connected) return;
      newItems = (result.events ?? [])
        .filter((e) => !seen.has(e.id))
        .map((e) => ({ itemId: e.id, payload: { ...e } }));
    } else if (trigger.app === "calendar" && trigger.title === "Event Cancelled") {
      // The Calendar API's default event list omits cancelled/deleted events
      // entirely (no showDeleted param is sent), so a "known id from the last
      // poll that's no longer in the window" is the closest cheap signal for
      // "cancelled" — approximate: a rescheduled-out-of-window event would
      // look identical to a genuine cancellation.
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          events: Array<{ id: string; summary?: string; status?: string }>;
        }>("automation.calendar.list", {
          userId: flow.userId,
          timeMin,
          timeMax,
          maxResults: 50,
        }),
      );
      if (!result?.connected) return;
      const currentIds = new Set((result.events ?? []).map((e) => e.id));
      const previouslyKnownIds = [...seen];
      newItems = previouslyKnownIds
        .filter((id) => !currentIds.has(id))
        .map((id) => ({ itemId: `cancelled:${id}`, payload: { id, cancelled: true } }));
      // Reset the known-id set to exactly this poll's window so the next
      // poll's diff is against what we just saw, not an ever-growing history.
      seen.clear();
      for (const id of currentIds) seen.add(id);
      cursorNeedsUpdate = true;
    } else if (trigger.app === "calendar" && trigger.title === "New or Updated Event") {
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          events: Array<{ id: string; summary?: string; updated?: string; start?: unknown; end?: unknown }>;
        }>("automation.calendar.list", {
          userId: flow.userId,
          timeMin,
          timeMax,
          maxResults: 50,
        }),
      );
      if (!result?.connected) return;
      // Encoding `updated` into the dedup id (instead of just the event id)
      // means an edited event looks "new" again — the cursor only tracks a
      // flat id set, so this avoids needing a second cursor field.
      newItems = (result.events ?? [])
        .map((e) => ({ itemId: `${e.id}:${e.updated ?? ""}`, payload: { ...e } }))
        .filter((item) => !seen.has(item.itemId));
    } else if (trigger.app === "calendar") {
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          events: Array<{
            id: string;
            summary?: string;
            start?: unknown;
            end?: unknown;
          }>;
        }>("automation.calendar.list", {
          userId: flow.userId,
          timeMin,
          timeMax,
          maxResults: 25,
        }),
      );
      if (!result?.connected) return;
      newItems = (result.events ?? [])
        .filter((e) => !seen.has(e.id))
        .map((e) => ({ itemId: e.id, payload: { ...e } }));
    } else if (
      trigger.app === "google-sheets" ||
      trigger.app === "google-forms"
    ) {
      // Both read a spreadsheet (Forms has no native trigger API here — the
      // response sheet Forms already writes to is the trigger source). Rows
      // have no stable id, so the row's 1-based position is the dedup key:
      // safe as long as rows are only ever appended, never reordered.
      const spreadsheetId = String(trigger.config?.spreadsheetId ?? "").trim();
      const range = String(trigger.config?.range ?? "Sheet1").trim();
      if (!spreadsheetId) return;
      const result = await firstValueFrom(
        this.aiCore.send<{ connected: boolean; rows?: string[][] }>(
          "automation.google.readSheetRows",
          {
            userId: flow.userId,
            spreadsheetId,
            range,
          },
        ),
      );
      if (!result?.connected) return;
      const rows = result.rows ?? [];
      const skipHeader = trigger.config?.hasHeaderRow !== false;
      newItems = rows
        .map((row, i) => ({ rowNumber: i + 1, row }))
        .filter(({ rowNumber }) => !skipHeader || rowNumber > 1)
        .filter(({ rowNumber }) => !seen.has(`row-${rowNumber}`))
        .map(({ rowNumber, row }) => ({
          itemId: `row-${rowNumber}`,
          payload: Object.fromEntries(row.map((v, i) => [`col${i + 1}`, v])),
        }));
    } else if (trigger.app === "airtable") {
      const baseId = String(trigger.config?.baseId ?? "").trim();
      const table = String(trigger.config?.table ?? "").trim();
      if (!baseId || !table) return;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          records?: Array<{
            id: string;
            createdTime: string;
            fields: Record<string, unknown>;
          }>;
        }>("automation.airtable.listRecords", {
          userId: flow.userId,
          baseId,
          table,
          maxRecords: 20,
        }),
      );
      if (!result?.connected) return;
      newItems = (result.records ?? [])
        .filter((r) => !seen.has(r.id))
        .map((r) => ({
          itemId: r.id,
          payload: { id: r.id, createdTime: r.createdTime, ...r.fields },
        }));
    } else if (trigger.app === "google-meet") {
      // A tight forward window, polled every AUTOMATION_POLL_MINUTES — "started"
      // means it falls inside whichever poll window catches its start time.
      const timeMin = now.toISOString();
      const timeMax = new Date(
        now.getTime() + env.AUTOMATION_POLL_MINUTES * 60_000,
      ).toISOString();
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          events: Array<{
            id: string;
            summary?: string;
            hangoutLink?: string;
            start?: unknown;
            end?: unknown;
          }>;
        }>("automation.calendar.list", {
          userId: flow.userId,
          timeMin,
          timeMax,
          maxResults: 25,
        }),
      );
      if (!result?.connected) return;
      newItems = (result.events ?? [])
        .filter((e) => e.hangoutLink && !seen.has(e.id))
        .map((e) => ({ itemId: e.id, payload: { ...e } }));
    } else if (trigger.app === "calcom") {
      // Polls every upcoming booking on the account — CalComBooking has no
      // eventTypeId field to scope by, so (unlike the "Create Booking" action)
      // there's no per-event-type config for this trigger.
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          bookings?: Array<{ id: number; uid: string; title: string; startTime: string }>;
        }>("automation.calcom.listBookings", { userId: flow.userId }),
      );
      if (!result?.connected) return;
      newItems = (result.bookings ?? [])
        .filter((b) => !seen.has(b.uid))
        .map((b) => ({ itemId: b.uid, payload: { ...b } }));
    } else if (trigger.app === "jira") {
      const projectKey = String(trigger.config?.projectKey ?? "").trim() || undefined;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          issues?: Array<{ key: string; summary: string; status: string; updated: string; url: string }>;
        }>("automation.jira.searchNewIssues", { userId: flow.userId, projectKey }),
      );
      if (!result?.connected) return;
      newItems = (result.issues ?? [])
        .filter((i) => !seen.has(i.key))
        .map((i) => ({ itemId: i.key, payload: { ...i } }));
    } else if (trigger.app === "pagerduty") {
      // config.serviceId is the same field the "Create Incident" action uses
      // — reused here to optionally scope the poll to one service.
      const serviceId = String(trigger.config?.serviceId ?? "").trim() || undefined;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          incidents?: Array<{ id: string; title: string; status: string; createdAt: string; url?: string }>;
        }>("automation.pagerduty.listIncidents", { userId: flow.userId, serviceId }),
      );
      if (!result?.connected) return;
      newItems = (result.incidents ?? [])
        .filter((i) => !seen.has(i.id))
        .map((i) => ({ itemId: i.id, payload: { ...i } }));
    } else if (trigger.app === "trello") {
      const listId = String(trigger.config?.listId ?? "").trim();
      if (!listId) return;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          cards?: Array<{ id: string; name: string; dateLastActivity: string; url: string }>;
        }>("automation.trello.listCards", { userId: flow.userId, listId }),
      );
      if (!result?.connected) return;
      newItems = (result.cards ?? [])
        .filter((c) => !seen.has(c.id))
        .map((c) => ({ itemId: c.id, payload: { ...c } }));
    } else if (trigger.app === "github" && trigger.title === "New Issue") {
      const repo = String(trigger.config?.repo ?? "").trim();
      if (!repo) return;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          issues?: Array<{
            number: number;
            title: string;
            html_url: string;
            state: string;
            created_at: string;
            user?: { login?: string };
          }>;
        }>("automation.github.listNewIssues", { userId: flow.userId, repo }),
      );
      if (!result?.connected) return;
      newItems = (result.issues ?? [])
        .filter((i) => !seen.has(String(i.number)))
        .map((i) => ({
          itemId: String(i.number),
          payload: {
            number: i.number,
            title: i.title,
            url: i.html_url,
            state: i.state,
            createdAt: i.created_at,
            author: i.user?.login,
          },
        }));
    } else if (trigger.app === "github" && trigger.title === "New Pull Request") {
      const repo = String(trigger.config?.repo ?? "").trim();
      if (!repo) return;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          pullRequests?: Array<{
            number: number;
            title: string;
            html_url: string;
            state: string;
            created_at: string;
            user?: { login?: string };
          }>;
        }>("automation.github.listNewPullRequests", { userId: flow.userId, repo }),
      );
      if (!result?.connected) return;
      newItems = (result.pullRequests ?? [])
        .filter((p) => !seen.has(String(p.number)))
        .map((p) => ({
          itemId: String(p.number),
          payload: {
            number: p.number,
            title: p.title,
            url: p.html_url,
            state: p.state,
            createdAt: p.created_at,
            author: p.user?.login,
          },
        }));
    } else if (trigger.app === "github" && trigger.title === "New Push") {
      // sha is omitted from the underlying request — GitHub defaults commit
      // listing to the repo's default branch, so no separate lookup is needed.
      const repo = String(trigger.config?.repo ?? "").trim();
      if (!repo) return;
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          commits?: Array<{
            sha: string;
            html_url: string;
            commit: { message: string; author?: { name?: string; date?: string } };
            author?: { login?: string } | null;
          }>;
        }>("automation.github.listNewCommits", { userId: flow.userId, repo }),
      );
      if (!result?.connected) return;
      newItems = (result.commits ?? [])
        .filter((c) => !seen.has(c.sha))
        .map((c) => ({
          itemId: c.sha,
          payload: {
            sha: c.sha,
            message: c.commit.message,
            author: c.author?.login ?? c.commit.author?.name,
            date: c.commit.author?.date,
            url: c.html_url,
          },
        }));
    } else if (trigger.app === "mongodb") {
      const collection = String(trigger.config?.collection ?? "").trim();
      if (!collection) return;
      const result = await firstValueFrom(
        this.aiCore.send<{ connected: boolean; documents?: Array<Record<string, unknown>> }>(
          "automation.mongo.pollNew",
          { userId: flow.userId, collection },
        ),
      );
      if (!result?.connected) return;
      newItems = (result.documents ?? [])
        .map((d) => ({ ...d, _id: String((d as { _id?: unknown })._id ?? "") }))
        .filter((d) => d._id && !seen.has(d._id))
        .map((d) => ({ itemId: d._id, payload: d }));
    } else if (trigger.app === "google-drive") {
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          files?: Array<{ id: string; name: string; createdTime: string; webViewLink?: string }>;
        }>("automation.drive.listRecentFiles", { userId: flow.userId }),
      );
      if (!result?.connected) return;
      newItems = (result.files ?? [])
        .filter((f) => !seen.has(f.id))
        .map((f) => ({ itemId: f.id, payload: { ...f } }));
    } else if (trigger.app === "bamboohr" && trigger.title === "New Time Off Request") {
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          requests?: Array<{ id: string; [key: string]: unknown }>;
        }>("automation.bamboohr.listTimeOffRequests", { userId: flow.userId }),
      );
      if (!result?.connected) return;
      newItems = (result.requests ?? [])
        .filter((r) => !seen.has(r.id))
        .map((r) => ({ itemId: r.id, payload: { ...r } }));
    } else if (trigger.app === "bamboohr" && trigger.title === "New Hire") {
      const result = await firstValueFrom(
        this.aiCore.send<{
          connected: boolean;
          employees?: Array<{ id: string; [key: string]: unknown }>;
        }>("automation.bamboohr.listNewHires", { userId: flow.userId }),
      );
      if (!result?.connected) return;
      newItems = (result.employees ?? [])
        .filter((e) => !seen.has(e.id))
        .map((e) => ({ itemId: e.id, payload: { ...e } }));
    } else {
      return;
    }

    let enqueuedAny = false;
    for (const item of newItems) {
      try {
        await enqueueAutomationRun({
          flowId: flow.id,
          userId: flow.userId,
          triggerItemId: item.itemId,
          triggerPayload: item.payload,
        });
        seen.add(item.itemId);
        enqueuedAny = true;
      } catch (error) {
        logger.warn("automation poll: enqueue failed", {
          flowId: flow.id,
          itemId: item.itemId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (enqueuedAny || cursorNeedsUpdate) {
      const seenIds = [...seen].slice(-200);
      const cursorRes = await fetch(
        `${gatewayUrl}/api/automations/_internal/${flow.id}/cursor`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            userId: flow.userId,
            cursor: { lastPolledAt: now.toISOString(), seenIds },
          }),
        },
      );
      if (!cursorRes.ok) {
        throw new Error(`automation_cursor_update_failed:${cursorRes.status}`);
      }
    }
  }

  private async forEachActiveUser(
    provider: string | undefined,
    fn: (userId: string) => Promise<void>,
  ): Promise<void> {
    type ActiveUsersResult = { users?: string[] };
    try {
      const result = await firstValueFrom(
        this.aiCore.send<ActiveUsersResult>(
          "users.active",
          provider ? { provider } : {},
        ),
      );
      const users = [...new Set(result.users ?? [])].filter(Boolean);
      if (users.length === 0) {
        logger.info("scheduler: no active users", { provider });
        return;
      }
      const concurrency = 5;
      for (let index = 0; index < users.length; index += concurrency) {
        const batch = users.slice(index, index + concurrency);
        const results = await Promise.allSettled(
          batch.map((userId) => fn(userId)),
        );
        results.forEach((result, resultIndex) => {
          if (result.status === "rejected") {
            logger.warn("scheduler: user task failed", {
              provider,
              userId: batch[resultIndex],
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            });
          }
        });
      }
    } catch (error) {
      logger.warn("scheduler: active user fanout failed", {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
