import { Injectable } from "@nestjs/common";
import {
  addPendingAction,
  clearPendingActions,
  getPendingAction,
  listPendingActions,
  removePendingAction,
  type AddPendingActionInput,
  type PendingActionRecord,
} from "@heyriz/shared/queue/pending-actions";
import { appendActionAudit } from "@heyriz/shared/action-audit";

export const APPROVAL_STORE = Symbol("APPROVAL_STORE");

export type PendingApprovalRecord = PendingActionRecord;
export type { AddPendingActionInput };

/**
 * Holds the approval-gated proposals between the "shall I?" message and the
 * principal's "yes". Multiple may be pending per user at once, each addressable
 * by a short id, with a TTL so stale proposals expire.
 */
export interface ApprovalStore {
  add(userId: string, input: AddPendingActionInput): Promise<PendingApprovalRecord>;
  list(userId: string): Promise<PendingApprovalRecord[]>;
  get(userId: string, id: string): Promise<PendingApprovalRecord | undefined>;
  remove(userId: string, id: string): Promise<void>;
  clear(userId: string): Promise<void>;
}

/** In-process store: used in tests and as a single-instance fallback. */
export class MemoryApprovalStore implements ApprovalStore {
  private readonly chats = new Map<
    string,
    { seq: number; records: Map<string, PendingApprovalRecord> }
  >();

  private chat(chatId: string) {
    let entry = this.chats.get(chatId);
    if (!entry) {
      entry = { seq: 0, records: new Map() };
      this.chats.set(chatId, entry);
    }
    return entry;
  }

  async add(chatId: string, input: AddPendingActionInput): Promise<PendingApprovalRecord> {
    const entry = this.chat(chatId);
    const id = String(++entry.seq);
    const record: PendingApprovalRecord = {
      id,
      tool: input.tool,
      payload: input.payload,
      preview: input.preview,
      label: input.label ?? input.preview.split("\n")[0]?.slice(0, 60) ?? input.tool,
      createdAt: new Date().toISOString(),
    };
    entry.records.set(id, record);
    return record;
  }

  async list(chatId: string): Promise<PendingApprovalRecord[]> {
    return [...this.chat(chatId).records.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }

  async get(chatId: string, id: string): Promise<PendingApprovalRecord | undefined> {
    return this.chat(chatId).records.get(id);
  }

  async remove(chatId: string, id: string): Promise<void> {
    const entry = this.chat(chatId);
    entry.records.delete(id);
    if (entry.records.size === 0) this.chats.delete(chatId);
  }

  async clear(chatId: string): Promise<void> {
    this.chats.delete(chatId);
  }
}

/** Production store: survives restarts and is shared across gateway instances. */
@Injectable()
export class RedisApprovalStore implements ApprovalStore {
  async add(userId: string, input: AddPendingActionInput) {
    const record = await addPendingAction(userId, input);
    await appendActionAudit({
      userId,
      event: "proposed",
      tool: input.tool,
      payload: input.payload,
      approvalId: record.id,
    }).catch(() => undefined);
    return record;
  }
  list(chatId: string) {
    return listPendingActions(chatId);
  }
  get(chatId: string, id: string) {
    return getPendingAction(chatId, id);
  }
  remove(chatId: string, id: string) {
    return removePendingAction(chatId, id);
  }
  clear(chatId: string) {
    return clearPendingActions(chatId);
  }
}
