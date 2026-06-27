import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";

export type DecisionRow = {
  id: string;
  content: string;
  topic: string | null;
  status: string;
  createdAt: string;
};

/**
 * Decisions are the first real intelligence layer: explicit choices/commitments
 * extracted from events, grouped by `topic` so a newer decision supersedes an
 * older one on the same topic (evolving state). Provenance via `event_id`.
 */
@Injectable()
export class DecisionRepository implements OnModuleDestroy {
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

  /** Marks every active decision on this topic superseded by `newId`. */
  async supersedeTopic(userId: string, topic: string, newId: string): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `update decisions
          set status = 'superseded', superseded_by = $3
        where user_id = $1 and topic = $2 and status = 'confirmed' and id <> $3`,
      [userId, topic, newId],
    );
  }

  async insertDecision(input: {
    userId: string;
    content: string;
    topic: string;
    eventId?: string;
    entityIds: string[];
  }): Promise<string | undefined> {
    if (!this.pool) return undefined;
    await this.ensureSchema();
    const res = await this.pool.query<{ id: string }>(
      `insert into decisions (user_id, content, topic, status, event_id)
       values ($1, $2, $3, 'confirmed', $4) returning id`,
      [input.userId, input.content, input.topic, input.eventId ?? null],
    );
    const id = res.rows[0]?.id;
    if (id) {
      for (const entityId of input.entityIds) {
        await this.pool.query(
          `insert into decision_entities (decision_id, entity_id)
           values ($1, $2) on conflict do nothing`,
          [id, entityId],
        );
      }
    }
    return id;
  }

  /** Active (non-superseded) decisions, optionally filtered by topic substring. */
  async activeDecisions(userId: string, topicLike?: string): Promise<DecisionRow[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const params: unknown[] = [userId];
    let where = "user_id = $1 and status = 'confirmed'";
    if (topicLike) {
      params.push(`%${topicLike.toLowerCase()}%`);
      where += ` and (topic ilike $2 or content ilike $2)`;
    }
    const res = await this.pool.query<{
      id: string;
      content: string;
      topic: string | null;
      status: string;
      created_at: string;
    }>(
      `select id, content, topic, status, created_at
         from decisions where ${where}
        order by created_at desc limit 50`,
      params,
    );
    return res.rows.map((r) => ({
      id: r.id,
      content: r.content,
      topic: r.topic,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  /** Active decisions linked to a specific entity ("what did I decide with X"). */
  async decisionsForEntity(userId: string, entityId: string): Promise<DecisionRow[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const res = await this.pool.query<{
      id: string;
      content: string;
      topic: string | null;
      status: string;
      created_at: string;
    }>(
      `select d.id, d.content, d.topic, d.status, d.created_at
         from decisions d
         join decision_entities de on de.decision_id = d.id
        where d.user_id = $1 and de.entity_id = $2 and d.status = 'confirmed'
        order by d.created_at desc limit 50`,
      [userId, entityId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      content: r.content,
      topic: r.topic,
      status: r.status,
      createdAt: r.created_at,
    }));
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
      create table if not exists decisions (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        content text not null,
        topic text,
        status text not null default 'confirmed',
        event_id uuid references events(id) on delete set null,
        superseded_by uuid references decisions(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(
      "create index if not exists decisions_user_topic on decisions (user_id, topic) where status = 'confirmed'",
    );
    await this.pool.query(`
      create table if not exists decision_entities (
        decision_id uuid not null references decisions(id) on delete cascade,
        entity_id uuid not null references entities(id) on delete cascade,
        primary key (decision_id, entity_id)
      )
    `);
  }
}
