import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { safeJobId } from "./job-id";
import { queueNames } from "./names";
import type { GmailPushJobData } from "./types";

let gmailPushQueue: Queue<GmailPushJobData> | undefined;

export function getGmailPushQueue() {
  gmailPushQueue ??= new Queue<GmailPushJobData>(queueNames.gmailPush, {
    connection: createRedisConnection(),
  });
  return gmailPushQueue;
}

export async function enqueueGmailPush(data: GmailPushJobData) {
  const jobId = safeJobId(
    `gmail-push:${data.userId}:${data.accountId}:${data.pubsubMessageId}`,
  );
  const job = await getGmailPushQueue().add("gmail-push", data, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 60 * 60 * 24, count: 5_000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  });
  return { jobId: job.id };
}
