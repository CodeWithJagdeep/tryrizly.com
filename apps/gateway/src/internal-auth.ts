import { timingSafeEqual } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { env } from "@heyriz/shared/env";

export function requireInternalSecret(secret: string | undefined): void {
  const expected = env.AUTH_INTERNAL_SECRET;
  if (!expected && env.NODE_ENV !== "production") return;
  if (expected && secret && safeEqual(secret, expected)) return;
  throw new UnauthorizedException("internal_secret_required");
}

export function safeEqual(actual: string | undefined, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function sanitizeReturnPath(value: string | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "https://heyriz.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
