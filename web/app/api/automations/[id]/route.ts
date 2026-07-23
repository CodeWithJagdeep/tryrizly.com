import { callGateway, deleteGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET(_request: Request, context: RouteContext<"/api/automations/[id]">) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const data = await callGateway<{ flow?: unknown; error?: string }>(
    `/api/automations/${encodeURIComponent(id)}?userId=${encodeURIComponent(session.userId)}`,
  ).catch(() => null);
  if (!data || data.error) {
    return Response.json({ message: data?.error ?? "not_found" }, { status: 404 });
  }
  return Response.json({ flow: data.flow });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/automations/[id]">) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const response = await deleteGateway<unknown>(
    `/api/automations/${encodeURIComponent(id)}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(response.payload, { status: response.ok ? 200 : response.status });
}
