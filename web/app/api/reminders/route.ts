import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  message: string;
  runAt?: string;
  repeat?: { cron: string; tz?: string };
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.message?.trim()) {
    return Response.json({ message: "message is required" }, { status: 400 });
  }

  const result = await callGateway<{ reminder?: unknown; error?: string }>(
    "/api/tasks/reminders",
    { userId: session.userId, message: body.message, runAt: body.runAt, repeat: body.repeat, source: "manual" },
  );

  if (result?.error) return Response.json({ message: result.error }, { status: 400 });
  return Response.json({ ok: true, reminder: result?.reminder }, { status: 202 });
}
