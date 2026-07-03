import { deleteGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const result = await deleteGateway<{ ok: boolean }>(
    `/api/reminders/${id}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result.payload, { status: result.ok ? 200 : 500 });
}
