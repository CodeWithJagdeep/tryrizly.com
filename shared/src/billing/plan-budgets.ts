/**
 * Single source of truth for each plan's monthly AI spend budget (USD).
 * Consumed by apps/billing (plan definitions shown to the customer) AND by
 * apps/ai-core (budget enforcement against real LLM cost) so the two can
 * never drift out of sync with each other.
 */
export type BillingPlanId = "free" | "starter" | "pro" | "business";

export const PLAN_AI_BUDGETS: Record<BillingPlanId, number> = {
  free: 0.5,
  starter: 15,
  pro: 35,
  business: 80,
};

export function isBillingPlanId(value: string): value is BillingPlanId {
  return value in PLAN_AI_BUDGETS;
}

/** Unknown/missing plan ids degrade to the Free budget rather than unlimited spend. */
export function aiBudgetForPlan(planId: string | undefined): number {
  if (planId && isBillingPlanId(planId)) return PLAN_AI_BUDGETS[planId];
  return PLAN_AI_BUDGETS.free;
}
