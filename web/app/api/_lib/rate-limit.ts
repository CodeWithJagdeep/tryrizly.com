import { NextResponse } from "next/server";

/**
 * Best-effort fixed-window rate limiter for unauthenticated public endpoints
 * (contact, careers, newsletter) to blunt email-sending abuse and cost/DoS.
 *
 * Caveat: this is an in-memory, per-instance counter. On serverless (Vercel)
 * each lambda has its own map, so the effective global limit scales with the
 * number of warm instances. It is a speed-bump, not a hard guarantee — for a
 * strict limit, back this with a shared store (the gateway already runs Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Occasionally evict stale buckets so the map can't grow unbounded under a
// spray of unique IPs.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Returns a 429 response if the caller has exceeded `limit` requests within
 * `windowMs` for the given `name`, otherwise null (request may proceed).
 */
export function rateLimit(
  request: Request,
  name: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): NextResponse | null {
  const now = Date.now();
  sweep(now);

  const key = `${name}:${clientIp(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }

  existing.count += 1;
  return null;
}
