import { createHash } from "node:crypto";
import { Redis } from "ioredis";
import { env } from "./env";

export type ActionAuditEvent =
  | "proposed"
  | "approved"
  | "rejected"
  | "blocked"
  | "executed"
  | "failed";

export type ActionAuditEntry = {
  id: string;
  event: ActionAuditEvent;
  tool: string;
  approvalId?: string;
  payloadHash: string;
  timestamp: string;
};

let redis: Redis | undefined;

function client() {
  redis ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  return redis;
}

function keyFor(userId: string) {
  const tenant = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  return `heyriz:action-audit:${tenant}`;
}

export function actionPayloadHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

export async function appendActionAudit(input: {
  userId: string;
  event: ActionAuditEvent;
  tool: string;
  payload: unknown;
  approvalId?: string;
}): Promise<string> {
  const timestamp = new Date().toISOString();
  return client().xadd(
    keyFor(input.userId),
    "MAXLEN",
    "~",
    1000,
    "*",
    "event",
    input.event,
    "tool",
    input.tool,
    "approvalId",
    input.approvalId ?? "",
    "payloadHash",
    actionPayloadHash(input.payload),
    "timestamp",
    timestamp,
  ) as Promise<string>;
}

export async function listActionAudit(userId: string, limit = 100): Promise<ActionAuditEntry[]> {
  const rows = await client().xrevrange(keyFor(userId), "+", "-", "COUNT", Math.min(500, limit));
  return rows.map(([id, fields]) => {
    const values = Object.fromEntries(
      Array.from({ length: Math.floor(fields.length / 2) }, (_, index) => [
        fields[index * 2] ?? "",
        fields[index * 2 + 1] ?? "",
      ]),
    );
    return {
      id,
      event: values.event as ActionAuditEvent,
      tool: values.tool,
      approvalId: values.approvalId || undefined,
      payloadHash: values.payloadHash,
      timestamp: values.timestamp,
    };
  });
}

export async function deleteActionAudit(userId: string): Promise<void> {
  await client().del(keyFor(userId));
}
