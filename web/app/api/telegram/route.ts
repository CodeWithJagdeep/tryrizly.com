import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const params = new URLSearchParams({ userId: session.userId });
  const result = await callGateway(`/api/telegram/history?${params.toString()}`);
  return Response.json(result);
}
