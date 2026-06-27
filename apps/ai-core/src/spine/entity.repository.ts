import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

export type EntityType = "person" | "company";
export type AliasKind = "email" | "name" | "phone" | "url";

export type EntityRow = { id: string; type: EntityType; canonicalName: string };

export type AliasInput = {
  alias: string;
  normalized: string;
  kind: AliasKind;
  source: string;
  confidence: number;
};

/**
 * The canonical entity spine (Postgres = source of truth). `entities` are the
 * real things (people/companies); `entity_aliases` are every raw form seen for
 * them, normalized for matching. Lives alongside the existing `memories` table
 * — additive, never replaces it.
 */
@Injectable()
export class EntityRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;
  private trgmReady = false;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  hasDb() {
    return Boolean(this.pool);
  }

  /** True once pg_trgm is confirmed available (enables fuzzy name matching). */
  fuzzyEnabled() {
    return this.trgmReady;
  }

  async findEntityByAlias(
    userId: string,
    normalized: string,
    kind: AliasKind,
  ): Promise<string | undefined> {
    if (!this.pool) return undefined;
    await this.ensureSchema();
    const res = await this.pool.query<{ entity_id: string }>(
      "select entity_id from entity_aliases where user_id = $1 and normalized = $2 and kind = $3 limit 1",
      [userId, normalized, kind],
    );
    return res.rows[0]?.entity_id;
  }

  async findEntityByFuzzyName(
    userId: string,
    normalized: string,
    threshold: number,
  ): Promise<{ entityId: string; similarity: number } | undefined> {
    if (!this.pool || !this.trgmReady) return undefined;
    await this.ensureSchema();
    const res = await this.pool.query<{ entity_id: string; sim: number }>(
      `select entity_id, similarity(normalized, $2) as sim
         from entity_aliases
        where user_id = $1 and kind = 'name' and similarity(normalized, $2) > $3
        order by sim desc
        limit 1`,
      [userId, normalized, threshold],
    );
    const row = res.rows[0];
    return row ? { entityId: row.entity_id, similarity: row.sim } : undefined;
  }

  async createEntity(
    userId: string,
    type: EntityType,
    canonicalName: string,
  ): Promise<string> {
    if (!this.pool) throw new Error("no_database");
    await this.ensureSchema();
    const res = await this.pool.query<{ id: string }>(
      `insert into entities (user_id, type, canonical_name)
       values ($1, $2, $3) returning id`,
      [userId, type, canonicalName],
    );
    return res.rows[0].id;
  }

  /** Idempotent on (user_id, normalized, kind) — one alias row per normalized key. */
  async upsertAlias(userId: string, entityId: string, a: AliasInput): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `insert into entity_aliases (entity_id, user_id, alias, normalized, kind, source, confidence)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, normalized, kind) do nothing`,
      [entityId, userId, a.alias, a.normalized, a.kind, a.source, a.confidence],
    );
  }

  async listEntities(
    userId: string,
    limit = 50,
    type?: EntityType,
  ): Promise<Array<EntityRow & { createdAt: string; emails: string[]; phones: string[]; urls: string[] }>> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const rows = await this.pool.query<{
      id: string;
      type: EntityType;
      canonical_name: string;
      created_at: string;
    }>(
      type
        ? "select id, type, canonical_name, created_at from entities where user_id = $1 and type = $2 order by created_at desc limit $3"
        : "select id, type, canonical_name, created_at from entities where user_id = $1 order by created_at desc limit $2",
      type ? [userId, type, limit] : [userId, limit],
    );
    if (rows.rows.length === 0) return [];

    const ids = rows.rows.map((r) => r.id);
    const aliases = await this.pool.query<{ entity_id: string; alias: string; kind: AliasKind }>(
      `select entity_id, alias, kind from entity_aliases
        where entity_id = any($1) and kind in ('email', 'phone', 'url')
        order by confidence desc`,
      [ids],
    );

    const emailMap = new Map<string, string[]>();
    const phoneMap = new Map<string, string[]>();
    const urlMap = new Map<string, string[]>();

    for (const a of aliases.rows) {
      if (a.kind === "email") {
        const list = emailMap.get(a.entity_id) ?? [];
        list.push(a.alias);
        emailMap.set(a.entity_id, list);
      } else if (a.kind === "phone") {
        const list = phoneMap.get(a.entity_id) ?? [];
        list.push(a.alias);
        phoneMap.set(a.entity_id, list);
      } else if (a.kind === "url") {
        const list = urlMap.get(a.entity_id) ?? [];
        list.push(a.alias);
        urlMap.set(a.entity_id, list);
      }
    }

    return rows.rows.map((r) => ({
      id: r.id,
      type: r.type,
      canonicalName: r.canonical_name,
      createdAt: r.created_at,
      emails: emailMap.get(r.id) ?? [],
      phones: phoneMap.get(r.id) ?? [],
      urls: urlMap.get(r.id) ?? [],
    }));
  }

  async getEntity(userId: string, entityId: string): Promise<EntityRow | undefined> {
    if (!this.pool) return undefined;
    await this.ensureSchema();
    const res = await this.pool.query<{ id: string; type: EntityType; canonical_name: string }>(
      "select id, type, canonical_name from entities where user_id = $1 and id = $2 limit 1",
      [userId, entityId],
    );
    const row = res.rows[0];
    return row ? { id: row.id, type: row.type, canonicalName: row.canonical_name } : undefined;
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

    // pg_trgm powers fuzzy name matching; degrade to exact-only if unavailable.
    try {
      await this.pool.query("create extension if not exists pg_trgm");
      this.trgmReady = true;
    } catch (error) {
      this.trgmReady = false;
      logger.warn("entity spine: pg_trgm unavailable, fuzzy match disabled", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await this.pool.query(`
      create table if not exists entities (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        type text not null,
        canonical_name text not null,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      create table if not exists entity_aliases (
        id uuid primary key default gen_random_uuid(),
        entity_id uuid not null references entities(id) on delete cascade,
        user_id text not null,
        alias text not null,
        normalized text not null,
        kind text not null,
        source text not null,
        confidence real not null default 1.0,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(
      "create unique index if not exists entity_aliases_user_norm_kind on entity_aliases (user_id, normalized, kind)",
    );
    if (this.trgmReady) {
      await this.pool
        .query(
          "create index if not exists entity_aliases_norm_trgm on entity_aliases using gin (normalized gin_trgm_ops)",
        )
        .catch((error: unknown) =>
          logger.warn("entity spine: trgm index create failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }
  }
}
