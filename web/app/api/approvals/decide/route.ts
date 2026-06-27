import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    decision?: "approve" | "reject";
  };
  if (!body.id || !body.decision) {
    return Response.json({ message: "id and decision are required" }, { status: 400 });
  }

  const result = await callGateway("/api/approvals/decide", {
    userId: session.userId,
    id: body.id,
    decision: body.decision,
  });
  return Response.json(result);
}
