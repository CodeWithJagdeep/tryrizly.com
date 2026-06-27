import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import type { EmailEventJobData } from "./types";

let emailEventQueue: Queue<EmailEventJobData> | undefined;

export function getEmailEventQueue() {
  emailEventQueue ??= new Queue<EmailEventJobData>(queueNames.emailEvents, {
    connection: createRedisConnection(),
  });
  return emailEventQueue;
}

export async function enqueueEmailEvent(data: EmailEventJobData) {
  const jobId = `email-event:${data.userId}:${data.messageId}`;

  const job = await getEmailEventQueue().add("email-event", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    jobId,
    removeOnComplete: { age: 60 * 60 * 24, count: 2_000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  });

  return { jobId: job.id, messageId: data.messageId };
}
