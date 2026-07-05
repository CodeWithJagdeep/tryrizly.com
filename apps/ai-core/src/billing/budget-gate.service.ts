import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { PlanBudgetService } from "./plan-budget.service";
import { UsageLedgerService } from "../llm/usage-ledger.service";
import { creditsForUsd } from "@heyriz/shared/billing/plan-budgets";

export type BudgetState = "ok" | "warn" | "exceeded";

export type BudgetCheck = {
  state: BudgetState;
  spendUsd: number;
  budgetUsd: number;
  ratio: number;
};

const WARN_RATIO = 0.8;

// Deliberately calendar-month, not the real cycle: this only dedupes a
// one-time "approaching your budget" chat nudge, not budget enforcement
// itself (see check()/summary(), which use the real cycle). Firing once per
// calendar month instead of once per trial/billing cycle is an inconsequential
// difference for a single non-critical message, not worth threading an async
// DB lookup through the whole agent reply path for.
function cycleKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
}

/**
 * Single choke point for "is this user over their plan's AI budget right now".
 * The agent loop uses this to drop to the cheap model tier; background-AI
 * callers (decide/brief/memory) use it to skip entirely once exceeded.
 *
 * The "cycle" is the user's real trial/billing window (PlanBudgetService.
 * getCycleWindow) — a trial that runs July 4 -> July 18 has no relationship
 * to the calendar month, so budget/credits reset with it, not on the 1st.
 */
@Injectable()
export class BudgetGateService {
  // In-memory "already warned this cycle" — a missed warning after a process
  // restart is a low-stakes nuisance, not worth a Postgres table.
  private readonly warnedThisCycle = new Set<string>();

  constructor(
    @Inject(PlanBudgetService) private readonly planBudget: PlanBudgetService,
    @Inject(UsageLedgerService) private readonly usageLedger: UsageLedgerService,
  ) {}

  async check(userId: string): Promise<BudgetCheck> {
    try {
      const cycle = await this.planBudget.getCycleWindow(userId);
      const [budgetUsd, spendUsd] = await Promise.all([
        this.planBudget.aiBudgetUsd(userId),
        this.usageLedger.spendSince(userId, cycle.start),
      ]);
      if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
        return { state: "ok", spendUsd, budgetUsd, ratio: 0 };
      }
      const ratio = spendUsd / budgetUsd;
      const state: BudgetState = ratio >= 1 ? "exceeded" : ratio >= WARN_RATIO ? "warn" : "ok";
      return { state, spendUsd, budgetUsd, ratio };
    } catch (error) {
      logger.warn("budget gate: check failed, defaulting to ok", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { state: "ok", spendUsd: 0, budgetUsd: Number.POSITIVE_INFINITY, ratio: 0 };
    }
  }

  /** True once per user per calendar month — call only when state === "warn". */
  consumeWarnOnce(userId: string): boolean {
    const key = `${userId}:${cycleKey()}`;
    if (this.warnedThisCycle.has(key)) return false;
    this.warnedThisCycle.add(key);
    return true;
  }

  /** Budget check plus a per-day, per-feature cost breakdown, for the dashboard's Usage view. */
  async summary(userId: string) {
    const cycle = await this.planBudget.getCycleWindow(userId);
    const [check, planId, dailyRaw] = await Promise.all([
      this.check(userId),
      this.planBudget.getPlanId(userId),
      this.usageLedger.dailyBreakdownSince(userId, cycle.start),
    ]);
    const creditsUsed = creditsForUsd(check.spendUsd);
    const creditsBudget = Number.isFinite(check.budgetUsd) ? creditsForUsd(check.budgetUsd) : Infinity;

    // Flat per-task totals across the whole cycle (was a separate query —
    // derivable from the same per-day rows instead of asking Postgres twice).
    const byTask = new Map<string, { costUsd: number; calls: number }>();
    for (const row of dailyRaw) {
      const cur = byTask.get(row.task) ?? { costUsd: 0, calls: 0 };
      cur.costUsd += row.costUsd;
      cur.calls += row.calls;
      byTask.set(row.task, cur);
    }
    const breakdown = [...byTask.entries()]
      .map(([task, v]) => ({ task, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd);

    // Per-day rows, each carrying its own per-feature split.
    const byDay = new Map<string, { credits: number; tasks: Array<{ task: string; credits: number; calls: number }> }>();
    for (const row of dailyRaw) {
      const day = byDay.get(row.day) ?? { credits: 0, tasks: [] };
      const credits = creditsForUsd(row.costUsd);
      day.credits += credits;
      day.tasks.push({ task: row.task, credits, calls: row.calls });
      byDay.set(row.day, day);
    }
    const daily = [...byDay.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));

    return {
      ...check,
      creditsUsed,
      creditsBudget,
      planId,
      cycleStart: cycle.start.toISOString(),
      cycleEnd: cycle.end ? cycle.end.toISOString() : null,
      breakdown,
      daily,
    };
  }
}
