import { deleteGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;
  const result = await deleteGateway<{ removed: boolean }>(
    `/api/memory/${encodeURIComponent(id)}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result.payload, { status: result.status });
}
