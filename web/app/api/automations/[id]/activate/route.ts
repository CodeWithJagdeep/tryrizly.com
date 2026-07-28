import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(_request: Request, context: RouteContext<"/api/automations/[id]/activate">) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await callGateway<{
    ok?: boolean;
    error?: string;
    issues?: Array<{ stepId?: string; path: string; message: string }>;
  }>(`/api/automations/${encodeURIComponent(id)}/activate`, { userId: session.userId }).catch(() => null);
  if (!data?.ok) {
    return Response.json(
      { ok: false, error: data?.error ?? "activation_failed", issues: data?.issues },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
