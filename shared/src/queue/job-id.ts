/**
 * BullMQ (since ~v5.x) rejects custom job ids containing ":" — it reserves the
 * colon as its Redis key delimiter. Every deterministic dedupe id we build must
 * pass through this before being used as a jobId or job-scheduler id.
 */
export function safeJobId(id: string): string {
  return id.replace(/:/g, "_");
}
