const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "pwd",
  "password_hash",
  "passwordhash",
  "secret",
  "client_secret",
  "clientsecret",
  "key_secret",
  "keysecret",
  "secret_key",
  "secretkey",
  "consumer_secret",
  "consumersecret",
  "token",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "auth_token",
  "authtoken",
  "bearer_token",
  "bearertoken",
  "bot_token",
  "bottoken",
  "api_key",
  "apikey",
  "authorization",
  "private_key",
  "privatekey",
  "connection_url",
  "connectionurl",
  "encrypted_payload",
  "encryptedpayload",
  "webhook_url",
  "webhookurl",
  "card_number",
  "cardnumber",
  "cvv",
  "cvc",
  "otp",
  "ssn",
  "session_id",
  "sessionid",
  "session_token",
  "sessiontoken",
  "cookie",
]);

const MAX_DEPTH = 8;
const MAX_KEYS = 100;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_LENGTH = 2_000;

/** Prevent database rows from turning credential-like fields into chat output. */
export function sanitizeDatabaseRows(rows: unknown[]): unknown[] {
  return rows.slice(0, 50).map((row) => sanitizeDatabaseValue(row));
}

export function sanitizeDatabaseValue(value: unknown): unknown {
  return sanitize(value, 0, new WeakSet<object>());
}

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== "object") return String(value);
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (seen.has(value)) return "[circular]";

  const bsonValue = value as { _bsontype?: string; toHexString?: () => string };
  if (bsonValue._bsontype === "ObjectId" && typeof bsonValue.toHexString === "function") {
    return bsonValue.toHexString();
  }

  seen.add(value);
  if (Array.isArray(value)) {
    const sanitized = value.slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitize(item, depth + 1, seen));
    seen.delete(value);
    return sanitized;
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).slice(0, MAX_KEYS)) {
    output[key] = isSensitiveKey(key)
      ? "[REDACTED]"
      : sanitize(child, depth + 1, seen);
  }
  seen.delete(value);
  return output;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return SENSITIVE_KEYS.has(normalized);
}
