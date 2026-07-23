import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET(_request: Request, context: RouteContext<"/api/automations/[id]/runs">) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await callGateway<{ runs?: unknown[]; error?: string }>(
    `/api/automations/${encodeURIComponent(id)}/runs?userId=${encodeURIComponent(session.userId)}`,
  ).catch(() => null);
  if (!data || data.error) {
    return Response.json({ runs: [] });
  }
  return Response.json({ runs: data.runs ?? [] });
}
