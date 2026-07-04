import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import { safeJobId } from "./job-id";
import type { WatchReplyJobData, WatchReplyRequest } from "./types";

let watchReplyQueue: Queue<WatchReplyJobData> | undefined;

export function getWatchReplyQueue() {
  watchReplyQueue ??= new Queue<WatchReplyJobData>(queueNames.watchReplies, {
    connection: createRedisConnection(),
  });

  return watchReplyQueue;
}

export async function enqueueWatchReply(request: WatchReplyRequest) {
  const attempt = request.attempt ?? 1;
  const maxAttempts = request.maxAttempts ?? 4;
  const delay = Math.max(request.delayMs ?? request.nextDelayMs, 0);
  const jobId = safeJobId(`watch-reply:${request.userId}:${request.threadId}:${attempt}`);

  const job = await getWatchReplyQueue().add(
    "watch-reply",
    {
      userId: request.userId,
      chatId: request.chatId,
      threadId: request.threadId,
      attempt,
      maxAttempts,
      baselineMessageCount: request.baselineMessageCount,
      fallbackMessage: request.fallbackMessage,
      nextDelayMs: request.nextDelayMs,
      reason: request.reason,
    },
    {
      attempts: 1,
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
    threadId: request.threadId,
    attempt,
    runAt: new Date(Date.now() + delay).toISOString(),
    delayMs: delay,
  };
}
