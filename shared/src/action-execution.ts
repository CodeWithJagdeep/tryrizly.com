import { createHash } from "node:crypto";
import { Redis } from "ioredis";
import { env } from "./env";
import { actionPayloadHash } from "./action-audit";

type StoredExecution = {
  state: "executing" | "completed" | "unknown";
  tool: string;
  payloadHash: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
};

export type ActionExecutionClaim =
  | { state: "claimed" }
  | { state: "completed"; result: unknown }
  | { state: "in_progress" | "unknown" };

let redis: Redis | undefined;

function client() {
  redis ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  return redis;
}

function keyFor(userId: string, executionId: string) {
  const tenant = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  const execution = createHash("sha256").update(executionId).digest("hex").slice(0, 32);
  return `heyriz:action-execution:${tenant}:${execution}`;
}

export async function claimActionExecution(input: {
  userId: string;
  executionId: string;
  tool: string;
  payload: unknown;
}): Promise<ActionExecutionClaim> {
  const key = keyFor(input.userId, input.executionId);
  const payloadHash = actionPayloadHash(input.payload);
  const record: StoredExecution = {
    state: "executing",
    tool: input.tool,
    payloadHash,
    updatedAt: new Date().toISOString(),
  };
  const claimed = await client().set(key, JSON.stringify(record), "EX", 30 * 86_400, "NX");
  if (claimed === "OK") return { state: "claimed" };

  const existing = parse(await client().get(key));
  if (!existing) return { state: "unknown" };
  if (existing.tool !== input.tool || existing.payloadHash !== payloadHash) {
    throw new Error("execution_id_payload_mismatch");
  }
  if (existing.state === "completed") return { state: "completed", result: existing.result };
  return { state: existing.state === "executing" ? "in_progress" : "unknown" };
}

export async function completeActionExecution(input: {
  userId: string;
  executionId: string;
  tool: string;
  payload: unknown;
  result: unknown;
}): Promise<void> {
  let storedResult = input.result;
  const serializedResult = JSON.stringify(storedResult);
  if (serializedResult && serializedResult.length > 100_000 && storedResult && typeof storedResult === "object") {
    const result = storedResult as Record<string, unknown>;
    storedResult = { tool: result.tool, status: result.status, message: result.message };
  }
  const record: StoredExecution = {
    state: "completed",
    tool: input.tool,
    payloadHash: actionPayloadHash(input.payload),
    updatedAt: new Date().toISOString(),
    result: storedResult,
  };
  await client().set(
    keyFor(input.userId, input.executionId),
    JSON.stringify(record),
    "EX",
    30 * 86_400,
  );
}

export async function markActionExecutionUnknown(input: {
  userId: string;
  executionId: string;
  tool: string;
  payload: unknown;
  error: unknown;
}): Promise<void> {
  const record: StoredExecution = {
    state: "unknown",
    tool: input.tool,
    payloadHash: actionPayloadHash(input.payload),
    updatedAt: new Date().toISOString(),
    error: input.error instanceof Error ? input.error.message.slice(0, 500) : String(input.error).slice(0, 500),
  };
  await client().set(keyFor(input.userId, input.executionId), JSON.stringify(record), "EX", 30 * 86_400);
}

export async function deleteActionExecutions(userId: string): Promise<void> {
  const tenant = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  let cursor = "0";
  do {
    const [next, keys] = await client().scan(cursor, "MATCH", `heyriz:action-execution:${tenant}:*`, "COUNT", 100);
    cursor = next;
    if (keys.length) await client().del(...keys);
  } while (cursor !== "0");
}

function parse(value: string | null): StoredExecution | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as StoredExecution;
  } catch {
    return undefined;
  }
}
