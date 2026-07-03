import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const tokenTtlSeconds = 60 * 60 * 24 * 7;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function signAuthToken(payload: { email: string; name?: string; tokenVersion?: number }) {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const body = {
    email: payload.email,
    name: payload.name,
    // Session epoch this token was minted at; checked against the user's current
    // epoch so a logout/"sign out everywhere" can revoke it server-side.
    sv: payload.tokenVersion ?? 0,
    iat: now,
    exp: now + tokenTtlSeconds,
  };
  const encodedHeader = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyAuthToken(token: string) {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) return null;

  const [encodedHeader, encodedBody, signature] = token.split(".");
  if (!encodedHeader || !encodedBody || !signature) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
  } catch {
    return null;
  }

  const expected = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) return null;

  let payload: { email?: string; name?: string; sv?: number; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8")) as {
      email?: string;
      name?: string;
      sv?: number;
      exp?: number;
    };
  } catch {
    return null;
  }

  if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export async function setAuthCookie(jwt: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: tokenTtlSeconds,
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ message }, { status });
}

export function sanitizeReturnPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, "https://rizly.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
