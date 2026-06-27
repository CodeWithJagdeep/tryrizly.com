import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const params = new URLSearchParams({
    userId: session.userId,
    email: session.email,
  });
  if (session.name) params.set("name", session.name);

  const result = await callGateway(`/api/billing/status?${params.toString()}`);
  return Response.json(result);
}
