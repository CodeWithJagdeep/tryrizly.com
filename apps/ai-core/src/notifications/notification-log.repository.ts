import { Injectable, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";

export type NotificationLogEntry = {
  id: string;
  userId: string;
  message: string;
  source: string;
  sentAt: string;
};

const inMemoryLog: NotificationLogEntry[] = [];

@Injectable()
export class NotificationLogRepository implements OnModuleInit {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async onModuleInit() {
    await this.ensureTable();
  }

  async append(entry: Omit<NotificationLogEntry, "id">): Promise<void> {
    const id = crypto.randomUUID();
    if (!this.pool) {
      inMemoryLog.unshift({ ...entry, id });
      if (inMemoryLog.length > 200) inMemoryLog.length = 200;
      return;
    }
    await this.pool.query(
      `INSERT INTO notification_log (id, user_id, message, source, sent_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, entry.userId, entry.message, entry.source, entry.sentAt],
    );
  }

  async list(userId: string, limit = 50): Promise<NotificationLogEntry[]> {
    if (!this.pool) {
      return inMemoryLog
        .filter((e) => e.userId === userId)
        .slice(0, limit);
    }
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      message: string;
      source: string;
      sent_at: string;
    }>(
      `SELECT id, user_id, message, source, sent_at
       FROM notification_log
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      message: r.message,
      source: r.source,
      sentAt: r.sent_at,
    }));
  }

  private async ensureTable() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id         text PRIMARY KEY,
        user_id    text NOT NULL,
        message    text NOT NULL,
        source     text NOT NULL DEFAULT 'system',
        sent_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS notification_log_user_id_idx ON notification_log (user_id, sent_at DESC)`,
    );
  }
}
