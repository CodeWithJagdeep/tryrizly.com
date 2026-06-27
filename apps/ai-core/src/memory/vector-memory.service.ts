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

    const memory: StoredMemory = {
      id,
      userId: input.userId,
      summary: input.summary,
      source: input.source,
      score: 1,
      createdAt,
      embedding: embedding ?? undefined,
      metadata: input.metadata,
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
        input.metadata ?? {},
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

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async loadCandidates(
    userId: string,
    source?: HeyRizEventSource,
  ): Promise<StoredMemory[]> {
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
