import { Redis } from "ioredis";
import { env } from "../env";

// Canonical multi-pending-approval store. One Redis HASH per chat holds every
// action awaiting the principal's yes/no — field = short numeric id, value =
// JSON record. HSET adds without clobbering siblings, so the gateway (chat
// proposals) and ai-core/worker (proactive email proposals) can both write
// concurrently without a read-modify-write race. Ids come from an atomic INCR
// counter so they're stable, natural ("approve 2"), and reset once the chat's
// queue drains. Mirrored by gateway's ApprovalStore, which delegates here.
const approvalKey = (chatId: string) => `heyriz:approval:${chatId}`;
const seqKey = (chatId: string) => `heyriz:approval-seq:${chatId}`;
const historyKey = (chatId: string) => `heyriz:history:${chatId}`;

const TTL_APPROVAL = 30 * 60;
const TTL_HISTORY = 45 * 60;
const MAX_TURNS = 12;

let client: Redis | undefined;

function getRedis() {
  client ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  return client;
}

export type PendingActionRecord = {
  id: string;
  tool: string;
  payload: Record<string, unknown>;
  preview: string;
  /** Short one-line label for the "which one?" list. */
  label: string;
  createdAt: string;
};

export type AddPendingActionInput = {
  tool: string;
  payload: Record<string, unknown>;
  preview: string;
  label?: string;
};

function firstLine(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? text;
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

/** Add a pending action; returns the stored record (with its assigned id). */
export async function addPendingAction(
  chatId: string,
  input: AddPendingActionInput,
): Promise<PendingActionRecord> {
  const redis = getRedis();
  const id = String(await redis.incr(seqKey(chatId)));
  const record: PendingActionRecord = {
    id,
    tool: input.tool,
    payload: input.payload,
    preview: input.preview,
    label: input.label ?? firstLine(input.preview),
    createdAt: new Date().toISOString(),
  };
  await redis.hset(approvalKey(chatId), id, JSON.stringify(record));
  await redis.expire(approvalKey(chatId), TTL_APPROVAL);
  await redis.expire(seqKey(chatId), TTL_APPROVAL);
  return record;
}

/** All pending actions for a chat, oldest first (so display order is stable). */
export async function listPendingActions(chatId: string): Promise<PendingActionRecord[]> {
  const raw = await getRedis().hgetall(approvalKey(chatId));
  const records: PendingActionRecord[] = [];
  for (const value of Object.values(raw)) {
    try {
      records.push(JSON.parse(value) as PendingActionRecord);
    } catch {
      // skip a corrupt entry rather than fail the whole list
    }
  }
  return records.sort((a, b) => Number(a.id) - Number(b.id));
}

export async function getPendingAction(
  chatId: string,
  id: string,
): Promise<PendingActionRecord | undefined> {
  const raw = await getRedis().hget(approvalKey(chatId), id);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PendingActionRecord;
  } catch {
    return undefined;
  }
}

/** Remove one action; resets the id counter once the queue is empty. */
export async function removePendingAction(chatId: string, id: string): Promise<void> {
  const redis = getRedis();
  await redis.hdel(approvalKey(chatId), id);
  if ((await redis.hlen(approvalKey(chatId))) === 0) {
    await redis.del(approvalKey(chatId), seqKey(chatId));
  }
}

export async function clearPendingActions(chatId: string): Promise<void> {
  await getRedis().del(approvalKey(chatId), seqKey(chatId));
}

/**
 * Add a pending action proposed by a proactive email notification. Identical to
 * addPendingAction — kept as a named entry point for the email pipeline so the
 * intent reads clearly at the call site.
 */
export async function addPendingEmailAction(
  chatId: string,
  input: AddPendingActionInput,
): Promise<PendingActionRecord> {
  return addPendingAction(chatId, input);
}

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

/**
 * Append a proactive assistant message to the gateway's conversation history
 * so the agent has context when the user replies.
 */
export async function appendProactiveMessage(
  chatId: string,
  content: string,
): Promise<void> {
  const redis = getRedis();
  const key = historyKey(chatId);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await redis.watch(key);
    const raw = await redis.get(key);
    let turns: ConversationTurn[] = [];
    try {
      turns = raw ? (JSON.parse(raw) as ConversationTurn[]) : [];
    } catch {
      turns = [];
    }
    const next = [
      ...turns,
      { role: "assistant" as const, content, timestamp: new Date().toISOString() },
    ].slice(-MAX_TURNS);
    const result = await redis.multi().set(key, JSON.stringify(next), "EX", TTL_HISTORY).exec();
    if (result) return;
  }
  throw new Error("conversation_history_conflict");
}
