import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { aiBudgetForPlan } from "@heyriz/shared/billing/plan-budgets";

type SubscriptionRow = { plan_id: string; status: string };
type TrialRow = { plan_id: string; ends_at: Date; consumed: boolean };
type PurchaseRow = { plan_id: string; status: string };

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
    const planId = await this.currentPlanId(userId);
    return aiBudgetForPlan(planId);
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

      const purchase = await this.pool.query<PurchaseRow>(
        `select plan_id, status from billing_purchases where user_id = $1
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
