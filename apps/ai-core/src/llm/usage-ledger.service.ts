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

  /** Per-task cost breakdown since `since`, for the dashboard's Usage view. */
  async breakdownSince(
    userId: string,
    since: Date,
  ): Promise<Array<{ task: string; costUsd: number; calls: number }>> {
    try {
      if (!this.pool) {
        const rows = inMemoryLog.filter((r) => r.userId === userId && r.createdAt >= since);
        const byTask = new Map<string, { costUsd: number; calls: number }>();
        for (const r of rows) {
          const cur = byTask.get(r.task) ?? { costUsd: 0, calls: 0 };
          cur.costUsd += r.costUsd;
          cur.calls += 1;
          byTask.set(r.task, cur);
        }
        return [...byTask.entries()]
          .map(([task, v]) => ({ task, ...v }))
          .sort((a, b) => b.costUsd - a.costUsd);
      }
      await this.ensureTable();
      const result = await this.pool.query<{ task: string; cost_usd: string | null; calls: string }>(
        `select task, sum(cost_usd) as cost_usd, count(*) as calls
         from llm_usage_log
         where user_id = $1 and created_at >= $2
         group by task
         order by sum(cost_usd) desc`,
        [userId, since],
      );
      return result.rows.map((r) => ({
        task: r.task,
        costUsd: Number(r.cost_usd ?? 0),
        calls: Number(r.calls),
      }));
    } catch (error) {
      logger.warn("usage ledger: breakdownSince failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /** Most recent individual calls (real activity feed, not aggregated) for the header credits popover. */
  async recentEntries(
    userId: string,
    limit = 15,
  ): Promise<Array<{ task: string; costUsd: number; createdAt: string }>> {
    try {
      if (!this.pool) {
        return inMemoryLog
          .filter((r) => r.userId === userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, limit)
          .map((r) => ({ task: r.task, costUsd: r.costUsd, createdAt: r.createdAt.toISOString() }));
      }
      await this.ensureTable();
      const result = await this.pool.query<{ task: string; cost_usd: string; created_at: Date }>(
        `select task, cost_usd, created_at from llm_usage_log
         where user_id = $1
         order by created_at desc
         limit $2`,
        [userId, limit],
      );
      return result.rows.map((r) => ({
        task: r.task,
        costUsd: Number(r.cost_usd),
        createdAt: r.created_at.toISOString(),
      }));
    } catch (error) {
      logger.warn("usage ledger: recentEntries failed", {
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
