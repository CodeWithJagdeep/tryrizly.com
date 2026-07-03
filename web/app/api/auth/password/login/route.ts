import { callGateway } from "../../_lib/gateway";
import { jsonError, setAuthCookie, signAuthToken } from "../../_lib/auth-store";

type LoginResult = {
  identity?: { email: string; name?: string; needsOnboarding?: boolean; tokenVersion?: number };
  error?: string;
  needsVerification?: boolean;
};

// OTP is only required at registration; a returning user with a verified
// password signs in directly, no re-verification per login.
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };

  const result = await callGateway<LoginResult>("/api/auth/login", body);
  if (!result.identity) {
    if (result.needsVerification) {
      return Response.json(
        { message: result.error ?? "Please verify your email first.", needsVerification: true },
        { status: 403 },
      );
    }
    return jsonError(result.error ?? "Invalid email or password", 401);
  }

  const jwt = signAuthToken(result.identity);
  await setAuthCookie(jwt);
  return Response.json({
    email: result.identity.email,
    user: { name: result.identity.name },
    isNew: Boolean(result.identity.needsOnboarding),
  });
}
