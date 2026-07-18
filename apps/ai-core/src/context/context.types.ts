export type HeyRizEventSource =
  | "telegram"
  | "gmail"
  | "calendar"
  | "database"
  | "razorpay"
  | "bullmq";

export type HeyRizPriority = "HIGH" | "MEDIUM" | "LOW";

export type HeyRizContextRequest = {
  userId: string;
  source: HeyRizEventSource;
  message?: string;
  contactName?: string;
  topic?: string;
};

export type StructuredContext = {
  activeDeals: string[];
  preferences: string[];
  pendingStates: string[];
};

export type SemanticMemoryHit = {
  id: string;
  summary: string;
  score: number;
  source: HeyRizEventSource;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type LiveScheduleEntry = {
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
};

export type LiveInboxEntry = { from: string; subject: string };

/**
 * Live, authoritative snapshot fetched at chat time (today's calendar + current
 * unread inbox). This is ground truth the agent trusts over fuzzy `semantic`
 * memory — it's what stops the agent answering "no meeting" from stale recall.
 */
export type LiveContext = {
  /** Backward-compatible aggregate; true when either live source is available. */
  connected: boolean;
  calendarConnected: boolean;
  inboxConnected: boolean;
  schedule: LiveScheduleEntry[];
  unread: LiveInboxEntry[];
};

export const EMPTY_LIVE: LiveContext = {
  connected: false,
  calendarConnected: false,
  inboxConnected: false,
  schedule: [],
  unread: [],
};

export type HeyRizRuntimeContext = {
  userId: string;
  source: HeyRizEventSource;
  currentMessage?: string;
  structured: StructuredContext;
  semantic: SemanticMemoryHit[];
  /** Today's live calendar + unread inbox — authoritative, refreshed per turn. */
  live: LiveContext;
  /** How the agent should address the principal right now (e.g. "sir", "boss"). */
  honorific: string;
  /** The principal's real name, for signing outbound emails (e.g. "Best, Jagdeep"). */
  principalName?: string;
  /** The principal's IANA timezone (e.g. "Asia/Kolkata") — use this for any time reasoning. */
  timezone: string;
  /** False until the principal has explicitly given a timezone — "timezone" above is a UTC default guess, not confirmed. */
  timezoneConfirmed: boolean;
  /** The language/style to reply in (e.g. "Hinglish"), or undefined to mirror the principal's own message. */
  language?: string;
  /** Provider names only (postgres/mongodb/razorpay) — no secrets. */
  connectedDataSources: string[];
};
