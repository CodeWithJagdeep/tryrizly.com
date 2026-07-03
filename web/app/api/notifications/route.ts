import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type NotificationEntry = {
  id: string;
  message: string;
  source: string;
  sentAt: string;
};

type NotificationResult = {
  entries?: NotificationEntry[];
};

const DEMO_NOTIFICATION_TERMS = [
  "arjun mehta",
  "maya kapoor",
  "sarah chen",
  "northstar.vc",
  "ledgerflow.io",
  "brightdesk.co",
];

function isDemoNotification(entry: NotificationEntry) {
  const source = entry.source.toLowerCase();
  if (source === "sample" || source === "demo" || source === "fake") return true;

  const message = entry.message.toLowerCase();
  return DEMO_NOTIFICATION_TERMS.some((term) => message.includes(term));
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "50" });
  const result = await callGateway<NotificationResult>(`/api/notifications?${params.toString()}`);
  return Response.json({
    ...result,
    entries: (result.entries ?? []).filter((entry) => !isDemoNotification(entry)),
  });
}
