import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(_request: Request, context: RouteContext<"/api/automations/[id]/pause">) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await callGateway<{ ok?: boolean; error?: string }>(
    `/api/automations/${encodeURIComponent(id)}/pause`,
    { userId: session.userId },
  ).catch(() => null);
  if (!data?.ok) {
    return Response.json({ ok: false, error: data?.error ?? "pause_failed" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
