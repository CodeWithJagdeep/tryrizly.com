import { cookies } from "next/headers";
import { normalizeEmail, verifyAuthToken } from "@/app/api/auth/_lib/auth-store";
import { currentTokenVersion } from "@/app/api/auth/_lib/session-version";

export async function requireSession(): Promise<{ email: string; name?: string; userId: string } | null> {
  const token = (await cookies()).get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  if (!session?.email) return null;

  // Reject tokens minted before the user's current session epoch (server-side
  // revocation). Fails open on gateway error — see currentTokenVersion.
  const current = await currentTokenVersion(normalizeEmail(session.email));
  if (current !== null && current !== (session.sv ?? 0)) return null;

  return { email: session.email, name: session.name, userId: normalizeEmail(session.email) };
}
