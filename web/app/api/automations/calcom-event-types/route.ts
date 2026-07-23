import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const data = await callGateway<{ connected?: boolean; eventTypes?: unknown[] }>(
    `/api/automations/calcom/event-types?userId=${encodeURIComponent(session.userId)}`,
  ).catch(() => null);
  return Response.json({ connected: data?.connected ?? false, eventTypes: data?.eventTypes ?? [] });
}
