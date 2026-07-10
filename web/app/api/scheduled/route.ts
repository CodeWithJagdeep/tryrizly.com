import { callGateway } from "@/app/api/auth/_lib/gateway";
import { demoEmailTasks, demoReminders, isDemoUser } from "@/app/api/_lib/demo-dashboard-data";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  if (isDemoUser(session.userId)) {
    return Response.json({
      tasks: demoEmailTasks(),
      reminders: demoReminders(),
    });
  }

  const params = new URLSearchParams({ userId: session.userId });
  const result = await callGateway(`/api/scheduled?${params.toString()}`);
  return Response.json(result);
}
