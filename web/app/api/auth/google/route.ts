import { callGateway } from "../_lib/gateway";
import { sanitizeReturnPath } from "../_lib/auth-store";
import {
  getAuthRedirectBaseUrl,
  resolveOAuthCallbackUrl,
} from "../_lib/redirect-url";

const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Response.json({ message: "Google OAuth env vars are missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectUri = resolveGoogleRedirectUri(request);
  const returnTo = sanitizeReturnPath(url.searchParams.get("return_to"));

  let stateResult: { state?: string; error?: string; message?: string };
  try {
    stateResult = await callGateway<{ state?: string; error?: string; message?: string }>("/api/auth/oauth/state", {
      provider: "google",
      returnTo,
      redirectUri,
    });
  } catch (error) {
    console.error("google oauth state init: gateway unreachable", error);
    stateResult = {};
  }

  if (!stateResult.state) {
    console.error("google oauth state init failed", {
      gatewayError: stateResult.error ?? stateResult.message ?? "no state returned",
      internalSecretConfigured: Boolean(process.env.AUTH_INTERNAL_SECRET),
      gatewayUrl: process.env.NEXT_PUBLIC_GATEWAY_URL,
    });
    const baseUrl = getAuthRedirectBaseUrl(request);
    return Response.redirect(`${baseUrl}/login?error=google_state_init_failed`);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", stateResult.state);

  return Response.redirect(authUrl);
}

// Always send the single registered production callback so the URI matches the
// Google OAuth client config regardless of which host (apex, www, preview) the
// visitor is on. Localhost keeps its own origin so local dev can complete the flow.
function resolveGoogleRedirectUri(request: Request) {
  return resolveOAuthCallbackUrl(
    request,
    GOOGLE_CALLBACK_PATH,
    process.env.GOOGLE_LOGIN_REDIRECT_URI,
  );
}
