import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import { safeJobId } from "./job-id";
import type { SpineJobData } from "./types";

let spineQueue: Queue<SpineJobData> | undefined;

export function getSpineQueue() {
  spineQueue ??= new Queue<SpineJobData>(queueNames.spine, {
    connection: createRedisConnection(),
  });
  return spineQueue;
}

/**
 * Enqueue a durable spine-ingest. Unlike the old fire-and-forget in-process
 * write, a transient DB/LLM failure here is retried (5 attempts, exponential
 * backoff) and, if it still fails, parked in the failed set for 30 days — a
 * real dead-letter trail instead of a swallowed log line. Idempotent per
 * (user, message) via jobId.
 */
export async function enqueueSpineIngest(data: SpineJobData) {
  const jobId = safeJobId(
    `spine:${data.userId}:${data.accountId ?? "primary"}:${data.messageId}`,
  );
  const job = await getSpineQueue().add("spine-ingest-email", data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000 },
    jobId,
    removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  });
  return { jobId: job.id, messageId: data.messageId };
}
