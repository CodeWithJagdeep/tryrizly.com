import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type MemoryRow = {
  id: string;
  summary: string;
  createdAt: string;
  metadata: {
    messageId?: string;
    threadId?: string;
    category?: string;
    person?: string;
    dueDate?: string;
  };
};

type TaskRow = {
  id: string;
  summary: string;
  source: string;
  status: string;
  createdAt: string;
};

type ScheduledResult = {
  tasks?: TaskRow[];
};

type ConnectorRow = {
  provider: string;
};


export type ProcessedEmail = {
  id: string;
  summary: string;
  category: string;
  tab: "business" | "updates" | "all";
  person: string;
  dueDate: string;
  createdAt: string;
  messageId: string;
};

// Categories that map to the "Business" tab
const BUSINESS_CATEGORIES = new Set([
  "payment_due",
  "meeting_request",
  "investor_update",
  "follow_up_needed",
  "general_high",
  "general_medium",
]);

// Categories that map to the "Updates" tab
const UPDATES_CATEGORIES = new Set([
  "account_alert",
  "newsletter",
  "otp",
  "general_low",
]);

export const CATEGORY_LABELS: Record<string, string> = {
  payment_due:      "Payment due",
  meeting_request:  "Meeting request",
  investor_update:  "Investor update",
  follow_up_needed: "Follow-up needed",
  general_high:     "Important",
  general_medium:   "General",
  general_low:      "General",
  account_alert:    "Account alert",
  newsletter:       "Newsletter",
  otp:              "OTP",
};

function toTab(category: string): ProcessedEmail["tab"] {
  if (BUSINESS_CATEGORIES.has(category)) return "business";
  if (UPDATES_CATEGORIES.has(category)) return "updates";
  return "all";
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "60" });

  const [memoriesRaw, scheduledResult, connectorsRaw] = await Promise.all([
    callGateway<MemoryRow[]>(`/api/emails/processed?${params.toString()}`).catch(() => null),
    callGateway<ScheduledResult>(`/api/scheduled?userId=${encodeURIComponent(session.userId)}`).catch(() => null),
    callGateway<ConnectorRow[]>(`/api/connectors?userId=${encodeURIComponent(session.userId)}`).catch(() => null),
  ]);

  const gmailConnected = (connectorsRaw ?? []).some((c) => c.provider === "google");

  const emails: ProcessedEmail[] = (memoriesRaw ?? []).map((m) => {
    const category = m.metadata.category ?? "general_medium";
    return {
      id: m.id,
      summary: m.summary,
      category,
      tab: toTab(category),
      person: m.metadata.person ?? "",
      dueDate: m.metadata.dueDate ?? "",
      createdAt: m.createdAt,
      messageId: m.metadata.messageId ?? "",
    };
  });

  const emailTasks = (scheduledResult?.tasks ?? []).filter(
    (t) => t.source === "gmail" || t.source === "email",
  );

  return Response.json({ emails, emailTasks, categoryLabels: CATEGORY_LABELS, gmailConnected });
}
