import { Injectable, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";

export type ChatMessageRole = "user" | "assistant";

export type ChatMessageEntry = {
  id: string;
  userId: string;
  sessionId: string | null;
  role: ChatMessageRole;
  content: string;
  source: string;
  createdAt: string;
};

let inMemorySeq = 0;
const inMemoryLog: (ChatMessageEntry & { seq: number })[] = [];
const IN_MEMORY_CAP = 500;

/**
 * Raw per-turn transcript, distinct from `memories` (a curated long-term
 * facts store that deliberately skips most turns — see auto-memory.service.ts).
 * This table exists purely so the dashboard sidebar can show real chat
 * history; it captures every turn going forward, not retroactively.
 *
 * Ordering uses a monotonic `seq` (bigserial), not `created_at` — two inserts
 * issued back-to-back in the same request can land in the same millisecond,
 * and Postgres gives no ordering guarantee for timestamp ties. `seq` does.
 */
@Injectable()
export class ChatMessageRepository implements OnModuleInit {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async onModuleInit() {
    await this.ensureTable();
  }

  async append(
    entry: Omit<ChatMessageEntry, "id" | "createdAt">,
  ): Promise<void> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if (!this.pool) {
      inMemorySeq += 1;
      inMemoryLog.push({ ...entry, id, createdAt, seq: inMemorySeq });
      if (inMemoryLog.length > IN_MEMORY_CAP) inMemoryLog.shift();
      return;
    }
    await this.pool.query(
      `INSERT INTO chat_messages (id, user_id, session_id, role, content, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, entry.userId, entry.sessionId, entry.role, entry.content, entry.source, createdAt],
    );
  }

  async list(userId: string, limit = 500): Promise<ChatMessageEntry[]> {
    if (!this.pool) {
      return inMemoryLog
        .filter((e) => e.userId === userId)
        .slice(-limit)
        .map(({ seq: _seq, ...rest }) => rest);
    }
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      session_id: string | null;
      role: ChatMessageRole;
      content: string;
      source: string;
      created_at: string;
    }>(
      `SELECT id, user_id, session_id, role, content, source, created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY seq DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
        source: r.source,
        createdAt: r.created_at,
      }))
      .reverse();
  }

  async deleteBySession(userId: string, sessionId: string): Promise<number> {
    if (!this.pool) {
      const before = inMemoryLog.length;
      for (let i = inMemoryLog.length - 1; i >= 0; i -= 1) {
        if (inMemoryLog[i].userId === userId && inMemoryLog[i].sessionId === sessionId) {
          inMemoryLog.splice(i, 1);
        }
      }
      return before - inMemoryLog.length;
    }
    const result = await this.pool.query(
      `DELETE FROM chat_messages WHERE user_id = $1 AND session_id = $2`,
      [userId, sessionId],
    );
    return result.rowCount ?? 0;
  }

  private async ensureTable() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id         text PRIMARY KEY,
        user_id    text NOT NULL,
        role       text NOT NULL,
        content    text NOT NULL,
        source     text NOT NULL DEFAULT 'unknown',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Additive migrations for tables created by an earlier version of this
    // repository — safe to run every boot.
    await this.pool.query(
      `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id text`,
    );
    await this.pool.query(
      `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS seq bigserial`,
    );
    // Superseded by chat_messages_user_seq_idx below — CREATE INDEX IF NOT
    // EXISTS is a no-op against an existing same-named index even when its
    // column list differs, so the old (user_id, created_at) index must be
    // dropped explicitly rather than "redefined" in place.
    await this.pool.query(`DROP INDEX IF EXISTS chat_messages_user_id_idx`);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS chat_messages_user_seq_idx ON chat_messages (user_id, seq DESC)`,
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages (session_id) WHERE session_id IS NOT NULL`,
    );
  }
}
