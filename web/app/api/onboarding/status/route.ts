import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const result = await callGateway(
    `/api/auth/onboarding-status?email=${encodeURIComponent(session.email)}`,
  );
  return Response.json(result);
}
