import { callGateway } from "../../_lib/gateway";
import { sanitizeReturnPath } from "../../_lib/auth-store";

const LINKEDIN_CALLBACK_PATH = "/api/auth/oauth/linkedin/callback";
const PRODUCTION_HOSTS = new Set(["getrizly.com", "www.getrizly.com"]);

export async function GET(request: Request) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const scopes = process.env.LINKEDIN_SCOPES || "openid profile email";

  if (!clientId) {
    return Response.json({ message: "LinkedIn OAuth env vars are missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectUri = resolveLinkedInRedirectUri(url);
  const returnTo = sanitizeReturnPath(url.searchParams.get("return_to"));

  let state: string | undefined;
  try {
    ({ state } = await callGateway<{ state: string }>("/api/auth/oauth/state", {
      provider: "linkedin",
      returnTo,
      redirectUri,
    }));
  } catch {
    state = undefined;
  }

  if (!state) {
    const baseUrl = process.env.WEB_APP_URL || new URL(request.url).origin;
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

function resolveLinkedInRedirectUri(requestUrl: URL) {
  if (PRODUCTION_HOSTS.has(requestUrl.hostname)) {
    return new URL(LINKEDIN_CALLBACK_PATH, requestUrl.origin).toString();
  }
  return (
    process.env.LINKEDIN_REDIRECT_URI ||
    new URL(LINKEDIN_CALLBACK_PATH, requestUrl.origin).toString()
  );
}
