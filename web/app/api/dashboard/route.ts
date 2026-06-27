import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type MemoryRow = { id: string; summary: string; createdAt: string; metadata: { category?: string } };
type ScheduledResult = { tasks?: { id: string }[]; reminders?: { id: string; runAt?: string; message: string }[] };

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const uid = encodeURIComponent(session.userId);

  const [emailsRaw, scheduled] = await Promise.all([
    callGateway<MemoryRow[]>(`/api/emails/processed?userId=${uid}&limit=5`).catch(() => null),
    callGateway<ScheduledResult>(`/api/scheduled?userId=${uid}`).catch(() => null),
  ]);

  const emailCount = (emailsRaw ?? []).length;
  const latestEmails = (emailsRaw ?? []).slice(0, 3).map((m) => ({
    id: m.id,
    summary: m.summary,
    category: m.metadata.category ?? "general",
    createdAt: m.createdAt,
  }));

  const nextReminder = (scheduled?.reminders ?? [])
    .filter((r) => r.runAt && new Date(r.runAt) > new Date())
    .sort((a, b) => new Date(a.runAt!).getTime() - new Date(b.runAt!).getTime())[0] ?? null;

  const taskCount = scheduled?.tasks?.length ?? 0;

  return Response.json({ emailCount, latestEmails, nextReminder, taskCount });
}
