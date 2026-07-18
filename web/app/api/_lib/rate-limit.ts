import { NextResponse } from "next/server";
import { callGateway } from "../auth/_lib/gateway";

/** Redis-backed fixed-window limiter shared by every web instance. */

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Returns a 429 response if the caller has exceeded `limit` requests within
 * `windowMs` for the given `name`, otherwise null (request may proceed).
 */
export async function rateLimit(
  request: Request,
  name: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const key = `${name}:${clientIp(request)}`;
  try {
    const shared = await callGateway<{ allowed?: boolean; retryAfter?: number }>(
      "/api/public/rate-limit",
      { name, key, limit, windowMs },
    );
    if (shared.allowed === true) return null;
    if (shared.allowed === false) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "retry-after": String(shared.retryAfter ?? 60) } },
      );
    }
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
}
