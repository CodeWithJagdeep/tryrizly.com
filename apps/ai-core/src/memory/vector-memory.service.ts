import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import {
  EmbeddingsService,
  cosineSimilarity,
} from "./embeddings.service";
import type {
  MemorySearchInput,
  MemoryStore,
  MemoryWriteInput,
  StoredMemory,
} from "./memory.types";
import type {
  HeyRizEventSource,
  SemanticMemoryHit,
} from "../context/context.types";
import { env } from "@heyriz/shared/env";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Time-aware vector memory. Text is stored with its embedding and a timestamp;
 * recall ranks by semantic similarity blended with recency and drops anything
 * below MEMORY_MIN_SCORE — so the agent only ever pulls memories that are
 * actually relevant, never a full dump. Persists to Postgres when DATABASE_URL
 * is set, otherwise keeps an in-process store. Falls back to keyword overlap
 * when no embeddings key is configured.
 */
@Injectable()
export class VectorMemoryService implements MemoryStore, OnModuleDestroy {
  private readonly inMemory: StoredMemory[] = [];
  private readonly pool?: Pool;
  private tableReady?: Promise<void>;

  constructor(
    @Inject(EmbeddingsService)
    private readonly embeddings: EmbeddingsService,
  ) {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async remember(input: MemoryWriteInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const embedding = await this.embeddings.embed(input.summary);

    const metadata = {
      provenance: input.metadata?.provenance ?? input.source,
      confidence: input.metadata?.confidence ?? "medium",
      expiresAt:
        input.metadata?.expiresAt ??
        new Date(Date.now() + DEFAULT_RETENTION_DAYS * DAY_MS).toISOString(),
      ...input.metadata,
    };
    const memory: StoredMemory = {
      id,
      userId: input.userId,
      summary: input.summary,
      source: input.source,
      score: 1,
      createdAt,
      embedding: embedding ?? undefined,
      metadata,
    };

    if (!this.pool) {
      this.inMemory.push(memory);
      return { id };
    }

    await this.ensureTable();
    await this.pool.query(
      `insert into memories (id, user_id, summary, source, embedding, metadata, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        input.userId,
        input.summary,
        input.source,
        embedding ? `[${embedding.join(",")}]` : null,
        metadata,
        createdAt,
      ],
    );
    return { id };
  }

  async search(input: MemorySearchInput): Promise<SemanticMemoryHit[]> {
    const limit = input.limit ?? 5;
    const queryEmbedding = await this.embeddings.embed(input.query);
    const candidates = await this.loadCandidates(input.userId, input.source);

    const scored = candidates
      .filter((memory) => !isExpired(memory.metadata?.expiresAt))
      .map((memory) => {
        const similarity = queryEmbedding
          ? memory.embedding
            ? cosineSimilarity(queryEmbedding, memory.embedding)
            : 0
          : keywordOverlap(memory.summary, input.query);
        return { memory, similarity };
      })
      .filter((entry) => entry.similarity >= env.MEMORY_MIN_SCORE)
      .map((entry) => ({
        memory: entry.memory,
        score: blendRecency(entry.similarity, entry.memory.createdAt),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ memory, score }) => ({
      id: memory.id,
      summary: memory.summary,
      score: Number(score.toFixed(4)),
      source: memory.source,
      createdAt: memory.createdAt,
    }));
  }

  /** List memories for a given source, newest first. Used by the web inbox view. */
  async listBySource(
    userId: string,
    source: HeyRizEventSource,
    limit = 50,
  ): Promise<Array<{ id: string; summary: string; createdAt: string; metadata: Record<string, unknown> }>> {
    await this.pruneExpired(userId);
    if (!this.pool) {
      return this.inMemory
        .filter((m) => m.userId === userId && m.source === source)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit)
        .map((m) => ({ id: m.id, summary: m.summary, createdAt: m.createdAt, metadata: (m.metadata ?? {}) as Record<string, unknown> }));
    }

    await this.ensureTable();
    const result = await this.pool.query<{
      id: string;
      summary: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `select id, summary, metadata, created_at
         from memories
        where user_id = $1 and source = $2
        order by created_at desc
        limit $3`,
      [userId, source, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      summary: row.summary,
      createdAt: new Date(row.created_at).toISOString(),
      metadata: row.metadata,
    }));
  }

  /** List a tenant's reviewable memories, newest first. */
  async list(userId: string, limit = 100) {
    const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
    const memories = await this.loadCandidates(userId);
    return memories
      .filter((memory) => !isExpired(memory.metadata?.expiresAt))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, safeLimit)
      .map((memory) => ({
        id: memory.id,
        userId: memory.userId,
        summary: memory.summary,
        source: memory.source,
        score: memory.score,
        createdAt: memory.createdAt,
        metadata: memory.metadata,
      }));
  }

  async forget(userId: string, id: string): Promise<boolean> {
    if (!this.pool) {
      const index = this.inMemory.findIndex((memory) => memory.id === id && memory.userId === userId);
      if (index < 0) return false;
      this.inMemory.splice(index, 1);
      return true;
    }
    await this.ensureTable();
    const result = await this.pool.query("delete from memories where id = $1 and user_id = $2", [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async forgetAll(userId: string): Promise<number> {
    if (!this.pool) {
      let removed = 0;
      for (let index = this.inMemory.length - 1; index >= 0; index -= 1) {
        if (this.inMemory[index]?.userId === userId) {
          this.inMemory.splice(index, 1);
          removed += 1;
        }
      }
      return removed;
    }
    await this.ensureTable();
    const result = await this.pool.query("delete from memories where user_id = $1", [userId]);
    return result.rowCount ?? 0;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async loadCandidates(
    userId: string,
    source?: HeyRizEventSource,
  ): Promise<StoredMemory[]> {
    await this.pruneExpired(userId);
    if (!this.pool) {
      return this.inMemory.filter(
        (m) => m.userId === userId && (!source || m.source === source),
      );
    }

    await this.ensureTable();
    const result = await this.pool.query<{
      id: string;
      summary: string;
      source: HeyRizEventSource;
      embedding: string | null;
      metadata: Record<string, string | number | boolean | null>;
      created_at: Date;
    }>(
      `select id, summary, source, embedding::text as embedding, metadata, created_at
       from memories
       where user_id = $1 ${source ? "and source = $3" : ""}
       order by created_at desc
       limit $2`,
      source
        ? [userId, env.MEMORY_MAX_CANDIDATES, source]
        : [userId, env.MEMORY_MAX_CANDIDATES],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId,
      summary: row.summary,
      source: row.source,
      score: 1,
      createdAt: new Date(row.created_at).toISOString(),
      embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
      metadata: row.metadata,
    }));
  }

  private ensureTable(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    this.tableReady ??= this.pool
      .query(
        `create extension if not exists vector;
         create table if not exists memories (
          id text primary key,
          user_id text not null,
          summary text not null,
          source text not null,
          embedding vector(1536),
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null
        )`,
      )
      .then(() => undefined);
    return this.tableReady;
  }

  private async pruneExpired(userId: string): Promise<void> {
    if (!this.pool) {
      for (let index = this.inMemory.length - 1; index >= 0; index -= 1) {
        const memory = this.inMemory[index];
        if (memory?.userId === userId && isExpired(memory.metadata?.expiresAt)) {
          this.inMemory.splice(index, 1);
        }
      }
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `delete from memories
        where user_id = $1
          and metadata ? 'expiresAt'
          and pg_input_is_valid(metadata->>'expiresAt', 'timestamptz')
          and (metadata->>'expiresAt')::timestamptz <= now()`,
      [userId],
    );
  }
}

function isExpired(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const expiresAt = Date.parse(value);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function keywordOverlap(summary: string, query: string): number {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return 0;
  const text = summary.toLowerCase();
  const matches = words.filter((word) => text.includes(word)).length;
  return matches / words.length;
}

export function blendRecency(similarity: number, createdAt: string): number {
  const ageDays = Math.max(0, (Date.now() - Date.parse(createdAt)) / DAY_MS);
  const recency = Math.exp(-ageDays / env.MEMORY_RECENCY_HALFLIFE_DAYS);
  const w = env.MEMORY_RECENCY_WEIGHT;
  return (1 - w) * similarity + w * recency;
}
