import { callGateway } from "../../_lib/gateway";
import { jsonError } from "../../_lib/auth-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  if (!body.email?.trim()) {
    return jsonError("Email is required");
  }

  const result = await callGateway<{ ok?: boolean; error?: string }>(
    "/api/auth/email/send-verification",
    body,
  );
  if (!result.ok) {
    return jsonError(result.error ?? "Could not send verification code");
  }

  return Response.json({ success: true });
}
