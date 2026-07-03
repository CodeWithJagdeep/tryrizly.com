import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const result = await callGateway<{ ok: boolean }>(`/api/tasks/${id}/done`, { userId: session.userId });
  return Response.json(result);
}
