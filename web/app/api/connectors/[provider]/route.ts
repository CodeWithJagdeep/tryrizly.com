import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { deleteGateway } from "@/app/api/auth/_lib/gateway";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/connectors/[provider]">,
) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const { provider } = await context.params;
  const response = await deleteGateway<unknown>(
    `/api/connectors/${encodeURIComponent(provider)}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(response.payload, { status: response.ok ? 200 : response.status });
}
