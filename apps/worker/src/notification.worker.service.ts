import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type {
  NotificationJobData,
  NotificationJobName,
} from "@heyriz/shared/queue/types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { sendTelegramMessage } from "@heyriz/shared/telegram";
import { sendEmail } from "@heyriz/shared/email";

async function resolveChatId(userId: string): Promise<string | undefined> {
  const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
  const secret = env.AUTH_INTERNAL_SECRET;
  // Global-chat fallback is single-user dev only. With a gateway configured we
  // never fall back: sending user A's notification to a shared chat is a leak.
  if (!gatewayUrl) return env.TELEGRAM_CHAT_ID;

  try {
    const headers: Record<string, string> = {};
    if (secret) headers["x-heyriz-internal-secret"] = secret;
    const res = await fetch(
      `${gatewayUrl}/api/telegram/resolve?userId=${encodeURIComponent(userId)}`,
      { headers },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { chatId?: string | null };
    return data.chatId ?? undefined;
  } catch {
    return undefined;
  }
}

// userIds are normalized email addresses (see web require-user), so an unlinked
// user can still be reached by email — but validate before trusting that.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmailFallback(userId: string, message: string): Promise<boolean> {
  if (!EMAIL_RE.test(userId)) return false;
  const telegramUrl = `${env.WEB_APP_URL}/dashboard/telegram`;
  return sendEmail({
    to: userId,
    subject: "A message from Riz",
    text: `${message}\n\nGet these instantly on Telegram instead: ${telegramUrl}\n\n— Rizly`,
    html: `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p><p><a href="${telegramUrl}">Link Telegram</a> to get these instantly on your phone.</p><p>— Rizly</p>`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Maps the job source to a connector provider name used for notification gating.
// "manual" = user-created reminder, always deliver. "gateway"/"ai-core" = system, always deliver.
const SOURCE_TO_PROVIDER: Record<string, string | null> = {
  calendar: "calendar",
  gmail: "gmail",
  gateway: null,
  "ai-core": null,
  manual: null,
};

async function isNotificationAllowed(userId: string, source: string): Promise<boolean> {
  const provider = SOURCE_TO_PROVIDER[source] ?? null;
  if (!provider) return true;

  const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
  const secret = env.AUTH_INTERNAL_SECRET;
  if (!gatewayUrl) return true;

  try {
    const headers: Record<string, string> = {};
    if (secret) headers["x-heyriz-internal-secret"] = secret;
    const res = await fetch(
      `${gatewayUrl}/api/connectors/notification-check?userId=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`,
      { headers },
    );
    if (!res.ok) return true; // fail open
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled !== false;
  } catch {
    return true; // fail open
  }
}

async function logNotificationSent(userId: string, message: string, source: string): Promise<void> {
  const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
  const secret = env.AUTH_INTERNAL_SECRET;
  if (!gatewayUrl) return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-heyriz-internal-secret"] = secret;
    await fetch(`${gatewayUrl}/api/notifications/log`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, message, source, sentAt: new Date().toISOString() }),
    });
  } catch { /* best-effort */ }
}

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<NotificationJobData, void, NotificationJobName>;

  onModuleInit() {
    this.worker = new Worker<NotificationJobData, void, NotificationJobName>(
      queueNames.notifications,
      async (job) => {
        logger.info("notification job started", {
          jobId: job.id,
          name: job.name,
          source: job.data.source,
          taskId: job.data.taskId,
          userId: job.data.userId,
        });

        const [chatId, allowed] = await Promise.all([
          resolveChatId(job.data.userId),
          isNotificationAllowed(job.data.userId, job.data.source ?? "manual"),
        ]);

        if (!chatId) {
          if (allowed && job.data.emailFallback !== false) {
            const emailed = await sendEmailFallback(job.data.userId, job.data.message);
            if (emailed) {
              void logNotificationSent(job.data.userId, job.data.message, job.data.source ?? "reminder");
              logger.info("notification delivered by email — no Telegram linked", {
                jobId: job.id,
                userId: job.data.userId,
              });
              return;
            }
          }
          logger.warn("notification job skipped — no chatId resolved", {
            jobId: job.id,
            userId: job.data.userId,
          });
          return;
        }

        if (!allowed) {
          logger.info("notification job skipped — connector notifications disabled", {
            jobId: job.id,
            userId: job.data.userId,
            source: job.data.source,
          });
          return;
        }

        await sendTelegramMessage({ chatId, text: job.data.message });

        void logNotificationSent(job.data.userId, job.data.message, job.data.source ?? "reminder");

        logger.info("notification job completed", {
          jobId: job.id,
          taskId: job.data.taskId,
          userId: job.data.userId,
        });
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      },
    );

    this.worker.on("failed", (job, error) => {
      logger.error("notification job failed", {
        jobId: job?.id,
        userId: job?.data?.userId,
        error: error.message,
      });
    });

    logger.info("notification worker listening", {
      queue: queueNames.notifications,
      framework: "nestjs",
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
