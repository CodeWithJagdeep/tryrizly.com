export type NotificationJobName = "telegram-notification" | "meeting-reminder";

export type NotificationJobData = {
  userId: string;
  message: string;
  source: "gateway" | "ai-core" | "calendar" | "gmail" | "manual";
  taskId?: string;
  meetingId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ReminderRequest = {
  userId?: string;
  message: string;
  /** One-shot absolute time. Omit when `repeat` is set. */
  runAt?: string;
  /** Recurring schedule — cron pattern evaluated in `tz` (defaults to DEFAULT_TIMEZONE). */
  repeat?: { cron: string; tz?: string };
  source?: NotificationJobData["source"];
  taskId?: string;
  dedupeKey?: string;
  metadata?: NotificationJobData["metadata"];
};

export type WatchReplyJobName = "watch-reply";

export type WatchReplyJobData = {
  userId: string;
  chatId: string | number | undefined;
  threadId: string;
  attempt: number;
  maxAttempts: number;
  baselineMessageCount: number;
  fallbackMessage: string;
  nextDelayMs: number;
  reason?: string;
};

export type WatchReplyRequest = Omit<WatchReplyJobData, "attempt" | "maxAttempts"> & {
  attempt?: number;
  maxAttempts?: number;
  delayMs?: number;
};

export type SpineJobName = "spine-ingest-email";

/**
 * A durable spine-ingest job. Carries only non-sensitive descriptors — the
 * worker re-fetches the email body live so a body never lands in Redis.
 * `extractDecisions` is decided upstream (category-gated) so the worker needs
 * no email-classification knowledge.
 */
export type SpineJobData = {
  userId: string;
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  extractDecisions: boolean;
  /** Raw CC header value from Gmail, e.g. "Name <email>, Name2 <email2>" */
  cc?: string;
};

export type OutboundEmailJobName = "outbound-email";

export type OutboundEmailJobData = {
  userId: string;
  to: string;
  subject: string;
  body: string;
};

export type EmailEventJobName = "email-event";

export type EmailEventJobData = {
  userId: string;
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  source: "push" | "poll";
};
