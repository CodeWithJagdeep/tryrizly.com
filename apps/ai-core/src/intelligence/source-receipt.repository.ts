import { createHash } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { Pool } from "pg";

export type EvidenceDeliveryState = "new" | "updated" | "already_reported";

export type SourceEvidence = {
  key: string;
  source: "slack" | "notion" | "gmail" | "calendar" | "discord";
  title: string;
  excerpt?: string;
  timestamp: string;
  url?: string;
  author?: string;
  location?: string;
};

type Receipt = { contentHash: string; reportCount: number };
const memoryReceipts = new Map<string, Receipt>();

@Injectable()
export class SourceReceiptRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL) this.pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  async classifyAndMark(
    userId: string,
    evidence: SourceEvidence[],
  ): Promise<Array<SourceEvidence & { deliveryState: EvidenceDeliveryState }>> {
    if (evidence.length === 0) return [];
    if (!this.pool) {
      return evidence.map((item) => {
        const key = memoryKey(userId, item.key);
        const contentHash = evidenceHash(item);
        const existing = memoryReceipts.get(key);
        const deliveryState = !existing
          ? "new"
          : existing.contentHash === contentHash
            ? "already_reported"
            : "updated";
        memoryReceipts.set(key, {
          contentHash,
          reportCount: (existing?.reportCount ?? 0) + 1,
        });
        return { ...item, deliveryState };
      });
    }

    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result: Array<SourceEvidence & { deliveryState: EvidenceDeliveryState }> = [];
      for (const item of evidence) {
        const hash = evidenceHash(item);
        const existing = await client.query<{ content_hash: string }>(
          `select content_hash from source_receipts
            where user_id = $1 and evidence_key = $2`,
          [userId, item.key],
        );
        const oldHash = existing.rows[0]?.content_hash;
        const deliveryState = !oldHash
          ? "new"
          : oldHash === hash
            ? "already_reported"
            : "updated";
        await client.query(
          `insert into source_receipts
            (user_id, evidence_key, source, content_hash, first_reported_at, last_reported_at, report_count)
           values ($1,$2,$3,$4,now(),now(),1)
           on conflict (user_id, evidence_key)
           do update set source = excluded.source,
                         content_hash = excluded.content_hash,
                         last_reported_at = now(),
                         report_count = source_receipts.report_count + 1`,
          [userId, item.key, item.source, hash],
        );
        result.push({ ...item, deliveryState });
      }
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    this.ready ??= this.pool
      .query(`
        create table if not exists source_receipts (
          user_id text not null,
          evidence_key text not null,
          source text not null,
          content_hash text not null,
          first_reported_at timestamptz not null,
          last_reported_at timestamptz not null,
          report_count integer not null default 1,
          primary key (user_id, evidence_key)
        );
        create index if not exists source_receipts_user_last
          on source_receipts (user_id, last_reported_at desc)
      `)
      .then(() => undefined);
    return this.ready;
  }
}

function evidenceHash(item: SourceEvidence): string {
  return createHash("sha256")
    .update(JSON.stringify([item.title, item.excerpt, item.timestamp, item.url]))
    .digest("hex");
}

function memoryKey(userId: string, evidenceKey: string): string {
  return `${userId}:${evidenceKey}`;
}
