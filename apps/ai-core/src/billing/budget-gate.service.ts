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

function currentCycleStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function cycleKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
}

/**
 * Single choke point for "is this user over their plan's AI budget right now".
 * The agent loop uses this to drop to the cheap model tier; background-AI
 * callers (decide/brief/memory) use it to skip entirely once exceeded.
 *
 * Billing has no `current_period_start` column (see plan-budget.service.ts),
 * so the cycle is approximated as the calendar month (UTC) rather than the
 * subscription's actual renewal date — close enough for a soft warn/degrade
 * signal, not exact invoicing.
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
      const [budgetUsd, spendUsd] = await Promise.all([
        this.planBudget.aiBudgetUsd(userId),
        this.usageLedger.spendSince(userId, currentCycleStart()),
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

  /** Budget check plus a per-task cost breakdown, for the dashboard's Usage view. */
  async summary(userId: string) {
    const cycleStart = currentCycleStart();
    const dailyWindowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [check, breakdown, planId, dailyRaw] = await Promise.all([
      this.check(userId),
      this.usageLedger.breakdownSince(userId, cycleStart),
      this.planBudget.getPlanId(userId),
      this.usageLedger.dailyTotalsSince(userId, dailyWindowStart, 14),
    ]);
    const creditsUsed = creditsForUsd(check.spendUsd);
    const creditsBudget = Number.isFinite(check.budgetUsd) ? creditsForUsd(check.budgetUsd) : Infinity;
    const daily = dailyRaw.map((d) => ({
      day: d.day,
      credits: creditsForUsd(d.costUsd),
    }));
    return {
      ...check,
      creditsUsed,
      creditsBudget,
      planId,
      cycleStart: cycleStart.toISOString(),
      breakdown,
      daily,
    };
  }
}
