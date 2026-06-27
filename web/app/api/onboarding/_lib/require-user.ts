import { cookies } from "next/headers";
import { normalizeEmail, verifyAuthToken } from "@/app/api/auth/_lib/auth-store";

export async function requireSession(): Promise<{ email: string; name?: string; userId: string } | null> {
  const token = (await cookies()).get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  if (!session?.email) return null;
  return { email: session.email, name: session.name, userId: normalizeEmail(session.email) };
}
