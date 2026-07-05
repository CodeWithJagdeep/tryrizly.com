import { callGateway } from "../../_lib/gateway";
import { jsonError } from "../../_lib/auth-store";

type ResetResult = { ok?: boolean; error?: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
  if (!body.token || !body.password) {
    return jsonError("Token and password are required", 400);
  }

  const result = await callGateway<ResetResult>("/api/auth/password/reset", {
    token: body.token,
    password: body.password,
  });
  if (!result.ok) {
    return jsonError(result.error ?? "This reset link is invalid or has expired.", 400);
  }
  return Response.json({ ok: true });
}
