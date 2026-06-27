import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";

export type EventType = "email" | "meeting" | "message";

export type EventInput = {
  userId: string;
  type: EventType;
  source: string; // gmail | calendar | chat
  sourceId?: string; // gmail messageId / calendar eventId — for live re-fetch + dedupe
  threadId?: string;
  timestamp: Date;
  /** SUMMARY only (subject/title/message) — never a full email body. */
  content: string;
  metadata?: Record<string, unknown>;
};

export type TimelineRow = {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  content: string;
  entities: string[];
};

/**
 * The event/timeline backbone. Every email/meeting/message becomes a timestamped
 * row linked (via event_entities) to the canonical entities it involves. Dedupes
 * on (user_id, source, source_id) so the 3-min email poll and backfill are
 * idempotent. Postgres is the source of truth; the vector index points at these.
 */
@Injectable()
export class EventRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private ready?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  hasDb() {
    return Boolean(this.pool);
  }

  /** Upserts the event (idempotent on source_id) and returns its id + whether this was a fresh insert. */
  async recordEvent(input: EventInput): Promise<{ id: string; inserted: boolean } | undefined> {
    if (!this.pool) return undefined;
    await this.ensureSchema();
    // xmax = 0 is true only for a row this same statement just inserted — the
    // standard trick to tell "fresh insert" from "conflict updated an existing
    // row" out of a single upsert, so re-syncs (e.g. the 5-min calendar poll)
    // don't repeat one-time-only work (like decision mining) on a row we've
    // already seen.
    const res = await this.pool.query<{ id: string; inserted: boolean }>(
      `insert into events (user_id, type, source, source_id, thread_id, timestamp, content, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, source, source_id)
       do update set content = excluded.content,
                     timestamp = excluded.timestamp,
                     metadata = excluded.metadata
       returning id, (xmax = 0) as inserted`,
      [
        input.userId,
        input.type,
        input.source,
        input.sourceId ?? null,
        input.threadId ?? null,
        input.timestamp.toISOString(),
        input.content,
        input.metadata ?? {},
      ],
    );
    const row = res.rows[0];
    return row ? { id: row.id, inserted: row.inserted } : undefined;
  }

  async linkEntity(eventId: string, entityId: string, role?: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `insert into event_entities (event_id, entity_id, role)
       values ($1, $2, $3) on conflict (event_id, entity_id) do nothing`,
      [eventId, entityId, role ?? null],
    );
  }

  /** Recent timeline with linked entity names — for verification/inspection. */
  async recentTimeline(userId: string, limit: number): Promise<TimelineRow[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const res = await this.pool.query<{
      id: string;
      type: string;
      source: string;
      timestamp: string;
      content: string;
      entities: string[];
    }>(
      `select e.id, e.type, e.source, e.timestamp, e.content,
              coalesce(array_agg(en.canonical_name) filter (where en.canonical_name is not null), '{}') as entities
         from events e
         left join event_entities ee on ee.event_id = e.id
         left join entities en on en.id = ee.entity_id
        where e.user_id = $1
        group by e.id
        order by e.timestamp desc
        limit $2`,
      [userId, limit],
    );
    return res.rows.map((r) => ({
      id: r.id,
      type: r.type,
      source: r.source,
      timestamp: r.timestamp,
      content: r.content,
      entities: r.entities,
    }));
  }

  /** All events linked to one entity, newest first (their cross-source history). */
  async entityTimeline(
    userId: string,
    entityId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      type: string;
      source: string;
      /** The real Gmail messageId / Calendar eventId — use this, not `id`, for any re-fetch (read_email_body, draft_email_reply, etc). `id` is our internal row id and means nothing to Google's APIs. */
      sourceId?: string;
      timestamp: string;
      content: string;
    }>
  > {
    if (!this.pool) return [];
    await this.ensureSchema();
    const res = await this.pool.query<{
      id: string;
      type: string;
      source: string;
      sourceId: string | null;
      timestamp: string;
      content: string;
    }>(
      `select e.id, e.type, e.source, e.source_id as "sourceId", e.timestamp, e.content
         from events e
         join event_entities ee on ee.event_id = e.id
        where e.user_id = $1 and ee.entity_id = $2
        order by e.timestamp desc
        limit $3`,
      [userId, entityId, limit],
    );
    return res.rows.map((r) => ({ ...r, sourceId: r.sourceId ?? undefined }));
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
      create table if not exists events (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        type text not null,
        source text not null,
        source_id text,
        thread_id text,
        timestamp timestamptz not null,
        content text not null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `);
    // NULL source_ids are mutually distinct in a unique index, so chat events
    // (no source_id) always insert while gmail/calendar events dedupe.
    await this.pool.query(
      "create unique index if not exists events_user_source_id on events (user_id, source, source_id)",
    );
    await this.pool.query(
      "create index if not exists events_user_ts on events (user_id, timestamp desc)",
    );
    await this.pool.query(`
      create table if not exists event_entities (
        event_id uuid not null references events(id) on delete cascade,
        entity_id uuid not null references entities(id) on delete cascade,
        role text,
        primary key (event_id, entity_id)
      )
    `);
  }
}
