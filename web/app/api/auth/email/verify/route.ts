import { callGateway } from "../../_lib/gateway";
import { jsonError, normalizeEmail, setAuthCookie, signAuthToken } from "../../_lib/auth-store";

type VerifyResult = { identity?: { email: string; name?: string }; error?: string };

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; otp?: string };

  const result = await callGateway<VerifyResult>("/api/auth/email/verify", body);
  if (!result.identity) {
    return jsonError(result.error ?? "Invalid or expired code", 400);
  }

  const jwt = signAuthToken(result.identity);
  await setAuthCookie(jwt);

  // Auto-start 15-day trial on first login; idempotent if already started.
  const userId = normalizeEmail(result.identity.email);
  callGateway("/api/billing/trial/start", {
    userId,
    email: result.identity.email,
    name: result.identity.name,
  }).catch(() => undefined);

  return Response.json({
    email: result.identity.email,
    user: { name: result.identity.name },
    isNew: false,
  });
}
