import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { aiBudgetForPlan, isCreditPackId, CREDIT_PACKS, usdForCredits } from "@heyriz/shared/billing/plan-budgets";

type SubscriptionRow = { plan_id: string; status: string };
type TrialRow = { plan_id: string; ends_at: Date; consumed: boolean };
type PurchaseRow = { plan_id: string; status: string };
type CycleRow = {
  status: string;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  created_at: Date;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated", "trialing"]);
const PAID_PURCHASE_STATUSES = new Set(["paid", "captured"]);

/**
 * Resolves a user's current plan id directly against the billing tables (ai-core
 * and billing share one Postgres database — no RPC hop needed) so budget
 * enforcement doesn't have to wait on a cross-service call. Mirrors the same
 * status-priority rules as BillingService.resolveAccess: active subscription >
 * live trial > paid one-time purchase > free.
 */
@Injectable()
export class PlanBudgetService implements OnModuleDestroy {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  /** No DATABASE_URL (local/dev) degrades to "unlimited" rather than blocking everything. */
  async aiBudgetUsd(userId: string): Promise<number> {
    if (!this.pool) return Number.POSITIVE_INFINITY;
    const [planId, cycle] = await Promise.all([
      this.currentPlanId(userId),
      this.getCycleWindow(userId),
    ]);
    const topUpUsd = await this.topUpUsdSince(userId, cycle.start);
    return aiBudgetForPlan(planId) + topUpUsd;
  }

  /** Public wrapper for the header credits badge — just the plan id, e.g. "free" | "starter" | "pro" | "business". */
  async getPlanId(userId: string): Promise<string> {
    return this.currentPlanId(userId);
  }

  /**
   * The user's REAL current billing/trial window, not a calendar-month
   * approximation — a trial that started July 4 and ends July 18 has no
   * relationship to "resets on the 1st". Falls back to the calendar month
   * only when there's no subscription/trial row at all (a free-tier account
   * that never started one), since there's no real anchor date to use.
   */
  async getCycleWindow(userId: string): Promise<{ start: Date; end: Date | null }> {
    if (!this.pool) return { start: currentCalendarMonthStart(), end: null };
    try {
      const result = await this.pool.query<CycleRow>(
        `select status, current_period_end, trial_ends_at, created_at
         from billing_subscriptions where user_id = $1
         order by case status
           when 'active' then 1
           when 'authenticated' then 2
           when 'trialing' then 3
           when 'created' then 4
           when 'pending' then 5
           else 9
         end, updated_at desc limit 1`,
        [userId],
      );
      const sub = result.rows[0];
      if (sub) {
        if (sub.status === "trialing" && sub.trial_ends_at) {
          return { start: sub.created_at, end: sub.trial_ends_at };
        }
        if (ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status) && sub.current_period_end) {
          // No stored period-start column — the last renewal is approximated
          // as one interval before the next one. All current plans are
          // monthly, so subtracting a month is exact for the common case.
          const end = new Date(sub.current_period_end);
          const start = new Date(end);
          start.setUTCMonth(start.getUTCMonth() - 1);
          return { start, end };
        }
      }
      return { start: currentCalendarMonthStart(), end: null };
    } catch (error) {
      logger.warn("plan budget: cycle window lookup failed, defaulting to calendar month", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { start: currentCalendarMonthStart(), end: null };
    }
  }

  /**
   * Sum of purchased credit-pack allowance since the real cycle start (packs
   * don't carry into the next cycle — see CREDIT_PACKS doc comment). Uses the
   * pack's redemption value (usdForCredits), not the price paid, since the
   * pack price is marked up above raw cost.
   */
  private async topUpUsdSince(userId: string, since: Date): Promise<number> {
    if (!this.pool) return 0;
    try {
      const result = await this.pool.query<{ plan_id: string }>(
        `select plan_id from billing_purchases
         where user_id = $1
           and status in ('paid', 'captured')
           and created_at >= $2`,
        [userId, since],
      );
      let usd = 0;
      for (const row of result.rows) {
        if (isCreditPackId(row.plan_id)) {
          usd += usdForCredits(CREDIT_PACKS[row.plan_id].credits);
        }
      }
      return usd;
    } catch (error) {
      logger.warn("plan budget: top-up lookup failed, ignoring top-ups", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private async currentPlanId(userId: string): Promise<string> {
    if (!this.pool) return "free";
    try {
      const subscription = await this.pool.query<SubscriptionRow>(
        `select plan_id, status from billing_subscriptions where user_id = $1
         order by case status
           when 'active' then 1
           when 'authenticated' then 2
           when 'trialing' then 3
           when 'created' then 4
           when 'pending' then 5
           else 9
         end, updated_at desc limit 1`,
        [userId],
      );
      const sub = subscription.rows[0];
      if (sub && ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status)) return sub.plan_id;

      const trial = await this.pool.query<TrialRow>(
        `select plan_id, ends_at, consumed from billing_trials where user_id = $1`,
        [userId],
      );
      const t = trial.rows[0];
      if (t && !t.consumed && new Date(t.ends_at).getTime() > Date.now()) return t.plan_id;

      // Credit packs are top-ups, never an access tier — excluded here so one
      // never gets mistaken for the plan_id whose budget defines this cycle
      // (topUpUsdSince adds their value separately, on top of whatever
      // tier this resolves to).
      const purchase = await this.pool.query<PurchaseRow>(
        `select plan_id, status from billing_purchases where user_id = $1
           and plan_id not like 'credits_%'
         order by case status when 'paid' then 1 when 'captured' then 2 else 9 end, updated_at desc limit 1`,
        [userId],
      );
      const p = purchase.rows[0];
      if (p && PAID_PURCHASE_STATUSES.has(p.status)) return p.plan_id;

      return "free";
    } catch (error) {
      logger.warn("plan budget: lookup failed, defaulting to free", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return "free";
    }
  }
}

function currentCalendarMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
