import { callGateway } from "../../../_lib/gateway";
import { normalizeEmail, sanitizeReturnPath, setAuthCookie, signAuthToken } from "../../../_lib/auth-store";
import { getAuthRedirectBaseUrl } from "../../../_lib/redirect-url";

type CompleteResult = {
  identity?: { email: string; name?: string; needsOnboarding?: boolean; tokenVersion?: number };
  returnTo?: string;
  error?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const baseUrl = getAuthRedirectBaseUrl(request);

  if (!code || !state) {
    return Response.redirect(`${baseUrl}/login?error=linkedin_missing_code`);
  }

  let result: CompleteResult;
  try {
    result = await callGateway<CompleteResult>("/api/auth/oauth/complete", {
      provider: "linkedin",
      code,
      state,
    });
  } catch (error) {
    console.error("linkedin oauth complete: gateway unreachable", error);
    return Response.redirect(`${baseUrl}/login?error=linkedin_exchange_failed`);
  }

  if (!result.identity) {
    return Response.redirect(`${baseUrl}/login?error=linkedin_${result.error ?? "failed"}`);
  }

  let jwt: string;
  try {
    jwt = signAuthToken(result.identity);
  } catch {
    return Response.redirect(`${baseUrl}/login?error=linkedin_session_init_failed`);
  }
  await setAuthCookie(jwt);

  // Auto-start 10-day trial on first login; idempotent if already started.
  const userId = normalizeEmail(result.identity.email);
  callGateway("/api/billing/trial/start", {
    userId,
    email: result.identity.email,
    name: result.identity.name,
  }).catch(() => undefined);

  const destination = result.identity.needsOnboarding ? "/onboarding" : sanitizeReturnPath(result.returnTo);
  return Response.redirect(new URL(destination, baseUrl));
}
