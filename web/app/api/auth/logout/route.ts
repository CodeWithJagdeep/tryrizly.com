import { cookies } from "next/headers";
import { normalizeEmail, verifyAuthToken } from "../_lib/auth-store";
import { callGateway } from "../_lib/gateway";
import { invalidateTokenVersion } from "../_lib/session-version";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;

  // Bump the server-side session epoch so this token (and any other outstanding
  // ones for the user) stop validating — real logout, not just a cookie clear.
  if (session?.email) {
    const email = normalizeEmail(session.email);
    await callGateway("/api/auth/logout", { email }).catch(() => undefined);
    invalidateTokenVersion(email);
  }

  cookieStore.delete("auth_token");
  return Response.json({ ok: true });
}
