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

    // Daily morning brief, calendar sweep, and inbox email poll.
    await this.queue.upsertJobScheduler(
      "morning-brief",
      { pattern: `0 ${env.MORNING_BRIEF_HOUR} * * *`, tz: env.DEFAULT_TIMEZONE },
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
    // Trial-expiry nudge: runs daily at 10 AM, ai-core fans out to users nearing end.
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
              this.aiCore.send("proactive.brief", { userId }),
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
          await this.nudgeExpiringTrials();
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

  private async nudgeExpiringTrials() {
    type ActiveUsersResult = { users?: string[] };
    type BillingStatus = { trial?: { active?: boolean; endsAt?: string } | null };

    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    const secret = env.AUTH_INTERNAL_SECRET;
    if (!gatewayUrl) return;

    let users: string[] = [];
    try {
      const result = await firstValueFrom(
        this.aiCore.send<ActiveUsersResult>("users.active", {}),
      );
      users = [...new Set(result.users ?? [])].filter(Boolean);
    } catch {
      return;
    }

    for (const userId of users) {
      try {
        const headers: Record<string, string> = {};
        if (secret) headers["x-heyriz-internal-secret"] = secret;
        const res = await fetch(
          `${gatewayUrl}/api/billing/status?userId=${encodeURIComponent(userId)}`,
          { headers },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as BillingStatus;
        const trial = data.trial;
        if (!trial?.active || !trial.endsAt) continue;

        const daysLeft = Math.ceil(
          (new Date(trial.endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        );

        if (daysLeft === 3 || daysLeft === 1) {
          await getNotificationQueue().add(
            "telegram-notification",
            {
              userId,
              message:
                daysLeft === 1
                  ? "⏰ Your HeyRiz free trial ends tomorrow. Subscribe now to keep access: /dashboard/upgrade"
                  : "⏰ Your HeyRiz free trial ends in 3 days. Subscribe to keep your reminders, email triage, and morning briefs: /dashboard/upgrade",
              source: "ai-core" as const,
            },
            { jobId: `trial-nudge:${userId}:d${daysLeft}` },
          );
          logger.info("trial nudge enqueued", { userId, daysLeft });
        }
      } catch (err) {
        logger.warn("trial nudge failed for user", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
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
