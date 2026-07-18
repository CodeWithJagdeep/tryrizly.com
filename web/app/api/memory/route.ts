import { callGateway, deleteGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });
  const memories = await callGateway<unknown[]>(
    `/api/memory?userId=${encodeURIComponent(session.userId)}&limit=200`,
  );
  return Response.json({ memories });
}

export async function DELETE() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });
  const result = await deleteGateway<{ removed: number }>(
    `/api/memory?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result.payload, { status: result.status });
}
