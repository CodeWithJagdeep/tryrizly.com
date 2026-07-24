import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import type { PriorityClassification } from "../llm/llm.types";

export type EmailAssessmentEvidenceLevel = "metadata" | "body";
export type EmailAssessmentOrigin = "background" | "interactive" | "push";

export type StoredEmailAssessment = {
  userId: string;
  messageId: string;
  policyVersion: string;
  classification: PriorityClassification;
  evidenceLevel: EmailAssessmentEvidenceLevel;
  origin: EmailAssessmentOrigin;
  assessedAt: string;
  expiresAt: string;
};

const inMemoryStore = new Map<string, StoredEmailAssessment>();
const inMemoryLocks = new Map<string, Promise<void>>();

function cacheKey(userId: string, messageId: string): string {
  return `${userId}:${messageId}`;
}

/**
 * Durable, non-content cache for canonical email importance decisions.
 *
 * Message bodies are never stored. A row contains only the compact
 * classification and its evidence level, keyed by Gmail's immutable message ID.
 * Production uses Postgres; the in-memory fallback keeps local/test behavior
 * coherent inside one ai-core process.
 */
@Injectable()
export class EmailAssessmentRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async getMany(
    userId: string,
    messageIds: string[],
    policyVersion: string,
  ): Promise<Map<string, StoredEmailAssessment>> {
    const uniqueIds = [...new Set(messageIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    if (!this.pool) {
      const now = Date.now();
      const result = new Map<string, StoredEmailAssessment>();
      for (const messageId of uniqueIds) {
        const stored = inMemoryStore.get(cacheKey(userId, messageId));
        if (
          stored?.policyVersion === policyVersion &&
          Date.parse(stored.expiresAt) > now
        ) {
          result.set(messageId, stored);
        }
      }
      return result;
    }

    await this.ensureSchema();
    const result = await this.pool.query<{
      userId: string;
      messageId: string;
      policyVersion: string;
      classification: PriorityClassification;
      evidenceLevel: EmailAssessmentEvidenceLevel;
      origin: EmailAssessmentOrigin;
      assessedAt: Date;
      expiresAt: Date;
    }>(
      `select user_id as "userId",
              message_id as "messageId",
              policy_version as "policyVersion",
              classification,
              evidence_level as "evidenceLevel",
              origin,
              assessed_at as "assessedAt",
              expires_at as "expiresAt"
         from email_assessments
        where user_id = $1
          and message_id = any($2::text[])
          and policy_version = $3
          and expires_at > now()`,
      [userId, uniqueIds, policyVersion],
    );

    return new Map(
      result.rows.map((row) => [
        row.messageId,
        {
          ...row,
          assessedAt: new Date(row.assessedAt).toISOString(),
          expiresAt: new Date(row.expiresAt).toISOString(),
        },
      ]),
    );
  }

  async put(record: StoredEmailAssessment): Promise<void> {
    if (!this.pool) {
      const key = cacheKey(record.userId, record.messageId);
      const existing = inMemoryStore.get(key);
      if (
        existing?.policyVersion === record.policyVersion &&
        existing.evidenceLevel === "body" &&
        record.evidenceLevel === "metadata"
      ) {
        return;
      }
      inMemoryStore.set(key, record);
      return;
    }

    await this.ensureSchema();
    await this.pool.query(
      `insert into email_assessments (
         user_id, message_id, policy_version, classification, evidence_level,
         origin, assessed_at, expires_at
       )
       values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       on conflict (user_id, message_id)
       do update set policy_version = excluded.policy_version,
                     classification = excluded.classification,
                     evidence_level = excluded.evidence_level,
                     origin = excluded.origin,
                     assessed_at = excluded.assessed_at,
                     expires_at = excluded.expires_at
       where email_assessments.policy_version <> excluded.policy_version
          or email_assessments.evidence_level <> 'body'
          or excluded.evidence_level = 'body'`,
      [
        record.userId,
        record.messageId,
        record.policyVersion,
        JSON.stringify(record.classification),
        record.evidenceLevel,
        record.origin,
        record.assessedAt,
        record.expiresAt,
      ],
    );
  }

  /**
   * Serializes classification cache misses for one email. PostgreSQL advisory
   * locks coordinate multiple ai-core replicas; the local lock covers
   * development and remains a fail-open fallback during a database outage.
   */
  async withMessageLock<T>(
    userId: string,
    messageId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const key = cacheKey(userId, messageId);
    if (!this.pool) return withLocalLock(key, task);

    let client;
    try {
      await this.ensureSchema();
      client = await this.pool.connect();
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [key],
      );
    } catch (error) {
      if (client) {
        await client.query("rollback").catch(() => undefined);
        client.release();
      }
      logger.warn(
        "email assessment database lock unavailable; using local lock",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return withLocalLock(key, task);
    }

    try {
      const result = await task();
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteAll(userId: string): Promise<void> {
    if (!this.pool) {
      for (const [key, value] of inMemoryStore) {
        if (value.userId === userId) inMemoryStore.delete(key);
      }
      return;
    }
    await this.ensureSchema();
    await this.pool.query("delete from email_assessments where user_id = $1", [
      userId,
    ]);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= this.buildSchema();
    return this.ready;
  }

  private async buildSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      create table if not exists email_assessments (
        user_id text not null,
        message_id text not null,
        policy_version text not null,
        classification jsonb not null,
        evidence_level text not null check (evidence_level in ('metadata', 'body')),
        origin text not null check (origin in ('background', 'interactive', 'push')),
        assessed_at timestamptz not null,
        expires_at timestamptz not null,
        primary key (user_id, message_id)
      )
    `);
    await this.pool.query(
      "create index if not exists email_assessments_user_expiry on email_assessments (user_id, expires_at desc)",
    );
  }
}

async function withLocalLock<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = inMemoryLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => gate);
  inMemoryLocks.set(key, chain);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (inMemoryLocks.get(key) === chain) inMemoryLocks.delete(key);
  }
}
