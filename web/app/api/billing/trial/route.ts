import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { planId?: string };
  const result = await callGateway("/api/billing/trial/start", {
    userId: session.userId,
    email: session.email,
    name: session.name,
    planId: body.planId,
  });

  return Response.json(result);
}
