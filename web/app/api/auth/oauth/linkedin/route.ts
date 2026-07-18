import { callGateway } from "../../_lib/gateway";
import { sanitizeReturnPath } from "../../_lib/auth-store";
import {
  getAuthRedirectBaseUrl,
  resolveOAuthCallbackUrl,
} from "../../_lib/redirect-url";

const LINKEDIN_CALLBACK_PATH = "/api/auth/oauth/linkedin/callback";

export async function GET(request: Request) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const scopes = process.env.LINKEDIN_SCOPES || "openid profile email";

  if (!clientId) {
    return Response.json({ message: "LinkedIn OAuth env vars are missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectUri = resolveLinkedInRedirectUri(request);
  const returnTo = sanitizeReturnPath(url.searchParams.get("return_to"));

  let state: string | undefined;
  try {
    ({ state } = await callGateway<{ state: string }>("/api/auth/oauth/state", {
      provider: "linkedin",
      returnTo,
      redirectUri,
    }));
  } catch (error) {
    console.error("linkedin oauth state init: gateway unreachable", error);
    state = undefined;
  }

  if (!state) {
    console.error("linkedin oauth state init failed", {
      internalSecretConfigured: Boolean(process.env.AUTH_INTERNAL_SECRET),
      gatewayUrl: process.env.NEXT_PUBLIC_GATEWAY_URL,
    });
    const baseUrl = getAuthRedirectBaseUrl(request);
    return Response.redirect(`${baseUrl}/login?error=linkedin_state_init_failed`);
  }

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl);
}

// Always send the single registered production callback so the URI matches the
// LinkedIn app config regardless of which host (apex, www, preview) the visitor
// is on. Localhost keeps its own origin so local dev can complete the flow.
function resolveLinkedInRedirectUri(request: Request) {
  return resolveOAuthCallbackUrl(
    request,
    LINKEDIN_CALLBACK_PATH,
    process.env.LINKEDIN_REDIRECT_URI,
  );
}
