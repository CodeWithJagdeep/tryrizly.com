import { deleteGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { sessionId } = await params;
  const result = await deleteGateway<{ ok: boolean; removed?: number }>(
    `/api/chat/history/${encodeURIComponent(sessionId)}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result.payload, { status: result.ok ? 200 : 500 });
}
