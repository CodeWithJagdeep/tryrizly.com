import { callGateway } from "../../_lib/gateway";
import { sanitizeReturnPath } from "../../_lib/auth-store";

export async function GET(request: Request) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const scopes = process.env.LINKEDIN_SCOPES || "openid profile email";

  if (!clientId || !redirectUri) {
    return Response.json({ message: "LinkedIn OAuth env vars are missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnPath(url.searchParams.get("return_to"));

  let state: string | undefined;
  try {
    ({ state } = await callGateway<{ state: string }>("/api/auth/oauth/state", {
      provider: "linkedin",
      returnTo,
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
