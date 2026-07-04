import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import { safeJobId } from "./job-id";
import type { OutboundEmailJobData } from "./types";

let queue: Queue<OutboundEmailJobData> | undefined;

function getQueue() {
  queue ??= new Queue<OutboundEmailJobData>(queueNames.outboundEmail, {
    connection: createRedisConnection(),
  });
  return queue;
}

export async function enqueueOutboundEmail(
  data: OutboundEmailJobData,
  sendAt: Date,
) {
  const delay = Math.max(0, sendAt.getTime() - Date.now());
  const jobId = safeJobId(`outbound-email:${data.userId}:${data.to}:${sendAt.getTime()}`);
  return getQueue().add("outbound-email", data, {
    delay,
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 15_000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  });
}
