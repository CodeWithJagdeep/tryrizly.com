import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";
import { queueNames } from "./names";
import { safeJobId } from "./job-id";
import type { AutomationRunStepResult } from "../automations/types";

export type AutomationRunJobData = {
  flowId: string;
  userId: string;
  /** De-dup key of the trigger item that fired this run (message id, event id, or poll timestamp for schedule). */
  triggerItemId: string;
  triggerPayload: Record<string, unknown>;
  /** Set when resuming after a "Delay" step — same run record, continues from this action index. */
  runId?: string;
  resumeFromIndex?: number;
  /** Step results from before the delay, carried through so the final finish() call has the full list. */
  priorResults?: AutomationRunStepResult[];
};

let automationRunQueue: Queue<AutomationRunJobData> | undefined;

export function getAutomationRunQueue() {
  automationRunQueue ??= new Queue<AutomationRunJobData>(queueNames.automationRuns, {
    connection: createRedisConnection(),
  });
  return automationRunQueue;
}

/**
 * jobId dedup on (flowId, triggerItemId) by default — a re-poll of the same
 * window can't double-fire a run. A "Delay" step resume passes `delayMs` and
 * a distinct `jobKey` (incorporating the resume index) so it doesn't collide
 * with the just-completed initial job's id.
 */
export async function enqueueAutomationRun(
  data: AutomationRunJobData,
  opts?: { delayMs?: number; jobKey?: string },
) {
  const jobId = safeJobId(`automation-run:${opts?.jobKey ?? `${data.flowId}:${data.triggerItemId}`}`);
  const job = await getAutomationRunQueue().add("automation-run", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    jobId,
    delay: opts?.delayMs,
    removeOnComplete: { age: 60 * 60 * 24, count: 2_000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  });
  return { jobId: job.id };
}
