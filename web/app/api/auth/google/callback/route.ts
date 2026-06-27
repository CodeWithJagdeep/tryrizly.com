import { callGateway } from "../../_lib/gateway";
import { normalizeEmail, sanitizeReturnPath, setAuthCookie, signAuthToken } from "../../_lib/auth-store";

type CompleteResult = {
  identity?: { email: string; name?: string };
  returnTo?: string;
  error?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const baseUrl = process.env.WEB_APP_URL || url.origin;

  if (!code || !state) {
    return Response.redirect(`${baseUrl}/login?error=google_missing_code`);
  }

  const result = await callGateway<CompleteResult>("/api/auth/oauth/complete", {
    provider: "google",
    code,
    state,
  });

  if (!result.identity) {
    return Response.redirect(`${baseUrl}/login?error=google_${result.error ?? "failed"}`);
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

  return Response.redirect(new URL(sanitizeReturnPath(result.returnTo), baseUrl));
}
