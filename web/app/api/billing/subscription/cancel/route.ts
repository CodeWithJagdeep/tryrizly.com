import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type CancelRequest = {
  subscriptionId?: string;
  providerSubscriptionId?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CancelRequest;
  const result = await callGateway("/api/billing/subscription/cancel", {
    userId: session.userId,
    email: session.email,
    name: session.name,
    subscriptionId: body.subscriptionId,
    providerSubscriptionId: body.providerSubscriptionId,
  });

  return Response.json(result);
}
