import { callGateway } from "./gateway";

/**
 * Resolves a user's current session epoch (tokenVersion) so requireSession can
 * reject tokens minted before a logout / "sign out everywhere".
 *
 * A short-TTL in-memory cache keeps this from adding a gateway round-trip to
 * every authenticated request — revocation therefore propagates within at most
 * CACHE_TTL_MS. On a gateway error we fail *open* (return null → skip the check):
 * the token's signature and expiry are still enforced locally, so a transient
 * outage briefly relaxes revocation rather than locking every user out.
 */

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { version: number; expiresAt: number }>();

export async function currentTokenVersion(email: string): Promise<number | null> {
  const now = Date.now();
  const cached = cache.get(email);
  if (cached && cached.expiresAt > now) return cached.version;

  try {
    const res = await callGateway<{ version?: number; error?: string }>(
      `/api/auth/session-version?email=${encodeURIComponent(email)}`,
    );
    if (typeof res.version !== "number") return null;
    cache.set(email, { version: res.version, expiresAt: now + CACHE_TTL_MS });
    return res.version;
  } catch {
    return null;
  }
}

/** Drops the cached version so the next check re-fetches immediately (used right after a logout). */
export function invalidateTokenVersion(email: string): void {
  cache.delete(email);
}
