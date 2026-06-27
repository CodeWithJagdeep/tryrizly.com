import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type CheckoutRequest = {
  mode?: "subscription" | "purchase";
  planId?: string;
  returnUrl?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  if (!body.planId) {
    return Response.json({ message: "planId_required" }, { status: 400 });
  }

  const path =
    body.mode === "purchase"
      ? "/api/billing/checkout/purchase"
      : "/api/billing/checkout/subscription";

  const result = await callGateway(path, {
    userId: session.userId,
    email: session.email,
    name: session.name,
    planId: body.planId,
    returnUrl: body.returnUrl,
  });

  return Response.json(result);
}
