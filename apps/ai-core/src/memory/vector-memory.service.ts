import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
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
    const summary = input.summary.trim().slice(0, 4_000);
    if (!summary) throw new Error("memory_summary_required");
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const candidateEmbedding = await this.embeddings.embed(summary);
    const embedding =
      candidateEmbedding?.length === env.EMBEDDINGS_DIMENSIONS ? candidateEmbedding : null;
    const dedupeKey =
      input.metadata?.dedupeKey?.toString() ??
      createHash("sha256")
        .update(`${input.source}|${String(input.metadata?.kind ?? "memory")}|${normalize(summary)}`)
        .digest("hex");

    const metadata = {
      provenance: input.metadata?.provenance ?? input.source,
      confidence: input.metadata?.confidence ?? "medium",
      dedupeKey,
      embeddingModel: embedding ? env.EMBEDDINGS_MODEL : "keyword-only",
      lastConfirmedAt: createdAt,
      expiresAt:
        input.metadata?.expiresAt ??
        new Date(Date.now() + DEFAULT_RETENTION_DAYS * DAY_MS).toISOString(),
      ...input.metadata,
    };
    const memory: StoredMemory = {
      id,
      userId: input.userId,
      summary,
      source: input.source,
      score: 1,
      createdAt,
      embedding: embedding ?? undefined,
      metadata,
    };

    if (!this.pool) {
      const existing = this.inMemory.find(
        (item) => item.userId === input.userId && item.metadata?.dedupeKey === dedupeKey,
      );
      if (existing) {
        existing.metadata = { ...existing.metadata, ...metadata };
        return { id: existing.id };
      }
      this.inMemory.push(memory);
      return { id };
    }

    await this.ensureTable();
    const existing = await this.pool.query<{ id: string }>(
      `select id from memories
        where user_id = $1 and metadata->>'dedupeKey' = $2
        limit 1`,
      [input.userId, dedupeKey],
    );
    if (existing.rows[0]?.id) {
      await this.pool.query(
        `update memories
            set metadata = metadata || $3::jsonb
          where id = $1 and user_id = $2`,
        [existing.rows[0].id, input.userId, JSON.stringify(metadata)],
      );
      return { id: existing.rows[0].id };
    }
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
    const candidates =
      this.pool && queryEmbedding?.length === env.EMBEDDINGS_DIMENSIONS
        ? await this.loadRelevantCandidates(input, queryEmbedding, limit).catch(() =>
            this.loadCandidates(input.userId, input.source),
          )
        : this.pool
          ? await this.loadLexicalCandidates(input, Math.max(limit * 8, 50)).catch(() =>
              this.loadCandidates(input.userId, input.source),
            )
          : await this.loadCandidates(input.userId, input.source);

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
      metadata: memory.metadata,
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

  /**
   * Hybrid retrieval over the full tenant corpus. Vector and full-text queries
   * each select their best candidates in Postgres before the common recency and
   * threshold ranking runs in TypeScript.
   */
  private async loadRelevantCandidates(
    input: MemorySearchInput,
    queryEmbedding: number[],
    limit: number,
  ): Promise<StoredMemory[]> {
    const candidateLimit = Math.max(limit * 8, 50);
    const [semantic, lexical] = await Promise.all([
      this.loadVectorCandidates(input, queryEmbedding, candidateLimit),
      this.loadLexicalCandidates(input, candidateLimit),
    ]);
    const unique = new Map<string, StoredMemory>();
    for (const memory of [...semantic, ...lexical]) unique.set(memory.id, memory);
    return [...unique.values()];
  }

  private async loadVectorCandidates(
    input: MemorySearchInput,
    queryEmbedding: number[],
    limit: number,
  ): Promise<StoredMemory[]> {
    if (!this.pool) return [];
    await this.ensureTable();
    const result = await this.pool.query<MemoryRow>(
      `select id, summary, source, embedding::text as embedding, metadata, created_at
         from memories
        where user_id = $1
          and embedding is not null
          and not (
            metadata ? 'expiresAt'
            and pg_input_is_valid(metadata->>'expiresAt', 'timestamptz')
            and (metadata->>'expiresAt')::timestamptz <= now()
          )
          ${input.source ? "and source = $4" : ""}
        order by embedding <=> $2::vector
        limit $3`,
      input.source
        ? [input.userId, `[${queryEmbedding.join(",")}]`, limit, input.source]
        : [input.userId, `[${queryEmbedding.join(",")}]`, limit],
    );
    return result.rows.map((row) => memoryFromRow(input.userId, row));
  }

  private async loadLexicalCandidates(
    input: MemorySearchInput,
    limit: number,
  ): Promise<StoredMemory[]> {
    if (!this.pool) return [];
    await this.ensureTable();
    const result = await this.pool.query<MemoryRow>(
      `select id, summary, source, embedding::text as embedding, metadata, created_at
         from memories
        where user_id = $1
          and to_tsvector('simple', summary) @@ plainto_tsquery('simple', $2)
          and not (
            metadata ? 'expiresAt'
            and pg_input_is_valid(metadata->>'expiresAt', 'timestamptz')
            and (metadata->>'expiresAt')::timestamptz <= now()
          )
          ${input.source ? "and source = $4" : ""}
        order by ts_rank_cd(to_tsvector('simple', summary), plainto_tsquery('simple', $2)) desc,
                 created_at desc
        limit $3`,
      input.source
        ? [input.userId, input.query, limit, input.source]
        : [input.userId, input.query, limit],
    );
    return result.rows.map((row) => memoryFromRow(input.userId, row));
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
          embedding vector(${env.EMBEDDINGS_DIMENSIONS}),
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null
        );
        create index if not exists memories_user_created
          on memories (user_id, created_at desc);
        create index if not exists memories_summary_fts
          on memories using gin (to_tsvector('simple', summary));
        create unique index if not exists memories_user_dedupe
          on memories (user_id, (metadata->>'dedupeKey'))
          where metadata ? 'dedupeKey'`,
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
  const words = [...new Set(tokenize(query))];
  if (words.length === 0) return 0;
  const textWords = new Set(tokenize(summary));
  const matches = words.filter((word) => textWords.has(word)).length;
  const coverage = matches / Math.min(words.length, 5);
  const phraseBoost = normalize(summary).includes(normalize(query)) ? 0.2 : 0;
  return Math.min(1, coverage + phraseBoost);
}

export function blendRecency(similarity: number, createdAt: string): number {
  const ageDays = Math.max(0, (Date.now() - Date.parse(createdAt)) / DAY_MS);
  const recency = Math.exp(-ageDays / env.MEMORY_RECENCY_HALFLIFE_DAYS);
  const w = env.MEMORY_RECENCY_WEIGHT;
  return (1 - w) * similarity + w * recency;
}

type MemoryRow = {
  id: string;
  summary: string;
  source: HeyRizEventSource;
  embedding: string | null;
  metadata: Record<string, string | number | boolean | null>;
  created_at: Date;
};

function memoryFromRow(userId: string, row: MemoryRow): StoredMemory {
  return {
    id: row.id,
    userId,
    summary: row.summary,
    source: row.source,
    score: 1,
    createdAt: new Date(row.created_at).toISOString(),
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
    metadata: row.metadata,
  };
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "did", "do", "for", "from", "has", "have",
  "i", "in", "is", "it", "latest", "me", "my", "of", "on", "the", "to", "was",
  "what", "when", "where", "with", "you",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function normalize(value: string): string {
  return tokenize(value).join(" ");
}
