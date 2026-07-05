import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

export type UsageLogEntry = {
  userId: string;
  task: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type InMemoryRow = UsageLogEntry & { createdAt: Date };

const inMemoryLog: InMemoryRow[] = [];

/**
 * Records every LLM call's cost so spend can be summed per user per billing
 * cycle (see BudgetGateService). Falls back to an in-memory array when
 * DATABASE_URL is unset (dev/test) — same convention as connector.repository.ts.
 * Recording is best-effort: a logging failure must never break the actual
 * LLM response path, so every public method swallows its own errors.
 */
@Injectable()
export class UsageLedgerService implements OnModuleDestroy {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async record(entry: UsageLogEntry): Promise<void> {
    try {
      if (!this.pool) {
        inMemoryLog.push({ ...entry, createdAt: new Date() });
        return;
      }
      await this.ensureTable();
      await this.pool.query(
        `insert into llm_usage_log (user_id, task, provider, model, tokens_in, tokens_out, cost_usd)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          entry.userId,
          entry.task,
          entry.provider,
          entry.model,
          entry.inputTokens,
          entry.outputTokens,
          entry.costUsd,
        ],
      );
    } catch (error) {
      logger.warn("usage ledger: record failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Sum of cost_usd for userId since `since` (inclusive). */
  async spendSince(userId: string, since: Date): Promise<number> {
    try {
      if (!this.pool) {
        return inMemoryLog
          .filter((r) => r.userId === userId && r.createdAt >= since)
          .reduce((sum, r) => sum + r.costUsd, 0);
      }
      await this.ensureTable();
      const result = await this.pool.query<{ total: string | null }>(
        `select sum(cost_usd) as total from llm_usage_log where user_id = $1 and created_at >= $2`,
        [userId, since],
      );
      return Number(result.rows[0]?.total ?? 0);
    } catch (error) {
      logger.warn("usage ledger: spendSince failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }


  /**
   * Cost per (day, task) — most recent day first — for the usage page's
   * per-day feature breakdown and the header popover's daily total. One row
   * per day-and-task rather than one per call: a single email-triage call
   * can cost a fraction of a credit, so a per-call feed mostly reads as "-0";
   * summing first gives real, non-zero numbers, and the caller sums across
   * tasks for the day's overall total.
   */
  async dailyBreakdownSince(
    userId: string,
    since: Date,
  ): Promise<Array<{ day: string; task: string; costUsd: number; calls: number }>> {
    try {
      if (!this.pool) {
        const rows = inMemoryLog.filter((r) => r.userId === userId && r.createdAt >= since);
        const byKey = new Map<string, { day: string; task: string; costUsd: number; calls: number }>();
        for (const r of rows) {
          const day = r.createdAt.toISOString().slice(0, 10);
          const key = `${day}:${r.task}`;
          const cur = byKey.get(key) ?? { day, task: r.task, costUsd: 0, calls: 0 };
          cur.costUsd += r.costUsd;
          cur.calls += 1;
          byKey.set(key, cur);
        }
        return [...byKey.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
      }
      await this.ensureTable();
      const result = await this.pool.query<{ day: Date; task: string; cost_usd: string; calls: string }>(
        `select date_trunc('day', created_at) as day, task, sum(cost_usd) as cost_usd, count(*) as calls
         from llm_usage_log
         where user_id = $1 and created_at >= $2
         group by date_trunc('day', created_at), task
         order by day desc`,
        [userId, since],
      );
      return result.rows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        task: r.task,
        costUsd: Number(r.cost_usd),
        calls: Number(r.calls),
      }));
    } catch (error) {
      logger.warn("usage ledger: dailyBreakdownSince failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async ensureTable() {
    if (!this.pool) return;
    await this.pool.query(`
      create table if not exists llm_usage_log (
        id bigserial primary key,
        user_id text not null,
        task text not null,
        provider text not null,
        model text not null,
        tokens_in integer not null default 0,
        tokens_out integer not null default 0,
        cost_usd numeric(12,6) not null default 0,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      create index if not exists llm_usage_log_user_created_idx
        on llm_usage_log (user_id, created_at)
    `);
  }
}
