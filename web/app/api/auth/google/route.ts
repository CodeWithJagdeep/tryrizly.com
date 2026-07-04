import { callGateway } from "../_lib/gateway";
import { sanitizeReturnPath } from "../_lib/auth-store";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return Response.json({ message: "Google OAuth env vars are missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnPath(url.searchParams.get("return_to"));

  let stateResult: { state?: string; error?: string };
  try {
    stateResult = await callGateway<{ state?: string; error?: string }>("/api/auth/oauth/state", {
      provider: "google",
      returnTo,
    });
  } catch {
    stateResult = {};
  }

  if (!stateResult.state) {
    const baseUrl = process.env.WEB_APP_URL || new URL(request.url).origin;
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
