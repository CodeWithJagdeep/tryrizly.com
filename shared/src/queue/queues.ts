import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import { safeJobId } from "./job-id";

export { safeJobId } from "./job-id";
import type { NotificationJobData, ReminderRequest } from "./types";

let notificationQueue: Queue | undefined;

export function getNotificationQueue() {
  notificationQueue ??= new Queue(queueNames.notifications, {
    connection: createRedisConnection(),
  });

  return notificationQueue;
}

/** Queue an immediate notification. Delivery resolves destinations by userId. */
export async function enqueueNotification(
  request: Omit<NotificationJobData, "source"> & { source?: NotificationJobData["source"] },
) {
  const job = await getNotificationQueue().add(
    "telegram-notification",
    { ...request, source: request.source ?? "ai-core" },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
      removeOnFail: { age: 60 * 60 * 24 * 7 },
    },
  );
  return { jobId: job.id };
}

export async function enqueueReminder(request: ReminderRequest) {
  const taskId = request.taskId ?? crypto.randomUUID();

  if (request.repeat) {
    const schedulerId = safeJobId(request.dedupeKey ?? `reminder:${taskId}`);
    const job = await getNotificationQueue().upsertJobScheduler(
      schedulerId,
      { pattern: request.repeat.cron, tz: request.repeat.tz },
      {
        name: "telegram-notification",
        data: {
          userId: request.userId ?? "default",
          message: request.message,
          source: request.source ?? "manual",
          taskId,
          metadata: request.metadata,
        },
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
          removeOnFail: { age: 60 * 60 * 24 * 7 },
        },
      },
    );

    return {
      jobId: job.id,
      taskId,
      repeat: request.repeat,
      schedulerId,
    };
  }

  if (!request.runAt) {
    throw new Error("runAt is required when repeat is not set");
  }

  const runAt = new Date(request.runAt);
  if (Number.isNaN(runAt.getTime())) {
    throw new Error("Invalid runAt date");
  }

  const delay = Math.max(runAt.getTime() - Date.now(), 0);
  const jobId = safeJobId(request.dedupeKey ?? `reminder:${taskId}`);

  const job = await getNotificationQueue().add(
    "telegram-notification",
    {
      userId: request.userId ?? "default",
      message: request.message,
      source: request.source ?? "manual",
      taskId,
      metadata: request.metadata,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
      delay,
      jobId,
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1_000,
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7,
      },
    },
  );

  return {
    jobId: job.id,
    taskId,
    runAt: runAt.toISOString(),
    delayMs: delay,
  };
}

export type ScheduledReminder = {
  id: string;
  message: string;
  recurring: boolean;
  state: "upcoming" | "fired" | "failed";
  /** ISO datetime for a one-time reminder. */
  runAt?: string;
  /** When the reminder actually fired (completed jobs only). */
  firedAt?: string;
  /** Cron pattern + tz for a recurring reminder. */
  cron?: string;
  tz?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Lists this user's reminders from BullMQ: upcoming (delayed/waiting),
 * recently fired (completed, kept 24 h), failed, and recurring schedulers.
 */
export async function listReminders(userId: string): Promise<ScheduledReminder[]> {
  const queue = getNotificationQueue();
  const [delayed, waiting, completed, failed, schedulers] = await Promise.all([
    queue.getJobs(["delayed"]),
    queue.getJobs(["waiting"]),
    queue.getJobs(["completed"]),
    queue.getJobs(["failed"]),
    queue.getJobSchedulers(),
  ]);

  type JobData = { userId?: string; message?: string; source?: string; metadata?: Record<string, unknown> };

  const upcoming: ScheduledReminder[] = [...delayed, ...waiting]
    .filter((job) => (job.data as JobData).userId === userId)
    .map((job) => ({
      id: String(job.id),
      message: (job.data as JobData).message ?? "",
      recurring: false,
      state: "upcoming" as const,
      runAt:
        job.opts?.delay != null
          ? new Date(job.timestamp + job.opts.delay).toISOString()
          : undefined,
      source: (job.data as JobData).source,
      metadata: (job.data as JobData).metadata,
    }));

  const fired: ScheduledReminder[] = completed
    .filter((job) => (job.data as JobData).userId === userId)
    .map((job) => ({
      id: String(job.id),
      message: (job.data as JobData).message ?? "",
      recurring: false,
      state: "fired" as const,
      runAt:
        job.opts?.delay != null
          ? new Date(job.timestamp + job.opts.delay).toISOString()
          : undefined,
      firedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      source: (job.data as JobData).source,
      metadata: (job.data as JobData).metadata,
    }));

  const failedReminders: ScheduledReminder[] = failed
    .filter((job) => (job.data as JobData).userId === userId)
    .map((job) => ({
      id: String(job.id),
      message: (job.data as JobData).message ?? "",
      recurring: false,
      state: "failed" as const,
      runAt:
        job.opts?.delay != null
          ? new Date(job.timestamp + job.opts.delay).toISOString()
          : undefined,
      source: (job.data as JobData).source,
      metadata: (job.data as JobData).metadata,
    }));

  const recurring: ScheduledReminder[] = schedulers
    .filter((s) => (s.template?.data as JobData | undefined)?.userId === userId)
    .map((s) => ({
      id: s.id ?? s.key,
      message: (s.template?.data as JobData | undefined)?.message ?? "",
      recurring: true,
      state: "upcoming" as const,
      cron: s.pattern,
      tz: s.tz,
      source: (s.template?.data as JobData | undefined)?.source,
      metadata: (s.template?.data as JobData | undefined)?.metadata,
    }));

  return [...upcoming, ...fired, ...failedReminders, ...recurring];
}

/** Cancel a pending one-time reminder (BullMQ job) or recurring scheduler by id, scoped to its owner. */
export async function cancelReminder(id: string, userId: string): Promise<boolean> {
  const queue = getNotificationQueue();
  const job = await queue.getJob(id);
  if (job) {
    if ((job.data as { userId?: string }).userId !== userId) return false;
    await job.remove();
    return true;
  }
  const schedulers = await queue.getJobSchedulers();
  const scheduler = schedulers.find((candidate) => (candidate.id ?? candidate.key) === id);
  if (!scheduler) return false;
  const owner = (scheduler.template?.data as { userId?: string } | undefined)?.userId;
  if (owner !== userId) return false;
  const removed = await queue.removeJobScheduler(id).catch(() => false);
  return Boolean(removed);
}
