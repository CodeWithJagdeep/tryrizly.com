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
import { getNotificationQueue } from "@heyriz/shared/queue/queues";
import { enqueueEmailEvent } from "@heyriz/shared/queue/email-events";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

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
      { pattern: `*/${env.MEETING_SYNC_MINUTES} * * * *`, tz: env.DEFAULT_TIMEZONE },
      { name: "meeting-sync", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "email-poll",
      { pattern: `*/${env.EMAIL_POLL_MINUTES} * * * *`, tz: env.DEFAULT_TIMEZONE },
      { name: "email-poll", data: {} },
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
            logger.info("scheduler tick handled", { job: job.name, userId, result });
          });
          return;
        }

        if (job.name === "meeting-sync") {
          await this.forEachActiveUser("calendar", async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.sync", { userId }),
            );
            logger.info("scheduler tick handled", { job: job.name, userId, result });
          });
          return;
        }

        if (job.name === "email-poll") {
          await this.pollInbox();
          return;
        }

        if (job.name === "weekly-digest") {
          await this.forEachActiveUser(undefined, async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.weeklyDigest", { userId }),
            );
            logger.info("scheduler tick handled", { job: job.name, userId, result });
          });
          return;
        }

        if (job.name === "daily-anomaly") {
          await this.forEachActiveUser(undefined, async (userId) => {
            const result = await firstValueFrom(
              this.aiCore.send("proactive.dailyAnomalyCheck", { userId }),
            );
            logger.info("scheduler tick handled", { job: job.name, userId, result });
          });
          return;
        }

        if (job.name === "trial-expiry-nudge") {
          await this.runBillingSweep();
          return;
        }
      },
      { connection, concurrency: 2 },
    );

    worker.on("failed", (job, error) => {
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

  /**
   * The billing service owns the sweep logic (who to nudge, expiry processing,
   * provider reconciliation — deduped in its own tables); this side owns the
   * clock and the notification queue, so it enqueues whatever the sweep returns.
   */
  private async runBillingSweep() {
    type SweepResult = {
      ok?: boolean;
      nudges?: Array<{ userId: string; kind: string; message: string; emailFallback?: boolean }>;
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
      const res = await fetch(`${gatewayUrl}/api/billing/sweep`, { method: "POST", headers });
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
          { jobId: `${nudge.kind}:${nudge.userId}:${new Date().toISOString().slice(0, 10)}` },
        );
        logger.info("billing nudge enqueued", { userId: nudge.userId, kind: nudge.kind });
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

  private async pollInbox() {
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
      let result: InboxResult | undefined;
      try {
        result = await firstValueFrom(
          this.aiCore.send<InboxResult>("gmail.listRecent", {
            userId,
            maxResults: 10,
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

      logger.info("email poll: enqueued", { userId, count: result.messages.length });
    });
  }

  private async forEachActiveUser(
    provider: string | undefined,
    fn: (userId: string) => Promise<void>,
  ): Promise<void> {
    type ActiveUsersResult = { users?: string[] };
    try {
      const result = await firstValueFrom(
        this.aiCore.send<ActiveUsersResult>("users.active", provider ? { provider } : {}),
      );
      const users = [...new Set(result.users ?? [])].filter(Boolean);
      if (users.length === 0) {
        logger.info("scheduler: no active users", { provider });
        return;
      }
      for (const userId of users) {
        await fn(userId);
      }
    } catch (error) {
      logger.warn("scheduler: active user fanout failed", {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
