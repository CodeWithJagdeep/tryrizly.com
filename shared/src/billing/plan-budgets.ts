/**
 * Single source of truth for each plan's monthly AI spend budget (USD).
 * Consumed by apps/billing (plan definitions shown to the customer) AND by
 * apps/ai-core (budget enforcement against real LLM cost) so the two can
 * never drift out of sync with each other.
 */
export type BillingPlanId = "free" | "starter" | "pro" | "business";

// Rescaled to the $20/$49/$100 sticker prices (was $49/$99/$199) — kept at
// roughly the same worst-case COGS ratio each tier had before (~30/35/40%).
export const PLAN_AI_BUDGETS: Record<BillingPlanId, number> = {
  free: 0.5,
  starter: 6,
  pro: 17,
  business: 40,
};

export function isBillingPlanId(value: string): value is BillingPlanId {
  return value in PLAN_AI_BUDGETS;
}

/** Unknown/missing plan ids degrade to the Free budget rather than unlimited spend. */
export function aiBudgetForPlan(planId: string | undefined): number {
  if (planId && isBillingPlanId(planId)) return PLAN_AI_BUDGETS[planId];
  return PLAN_AI_BUDGETS.free;
}

// ── Credits ──────────────────────────────────────────────────────────────────
// "Credits" are a marketing-facing relabeling of the same USD budget above —
// not a separate ledger. 1 credit = $0.005 of allowed AI spend. Every included
// plan allotment converts at this exact rate (no margin hidden here; that
// margin already lives in the subscription price vs. PLAN_AI_BUDGETS). Purchased
// top-up packs are priced ABOVE this rate — see CREDIT_PACKS — so margin on
// top-ups is explicit in the pack price, not in a second conversion rate.

export const CREDITS_PER_DOLLAR = 200;
export const MIN_CREDITS_PER_AI_TASK = 1;

export function creditsForUsd(usd: number): number {
  return Math.round(usd * CREDITS_PER_DOLLAR);
}

export function usdForCredits(credits: number): number {
  return credits / CREDITS_PER_DOLLAR;
}

/**
 * User-facing AI usage is metered in whole credits per recorded LLM task.
 * This keeps the dashboard readable and gives tiny calls a real minimum charge
 * for latency/infrastructure overhead, while still preserving token-based
 * proportionality for larger calls.
 */
export function billableCreditsForAiTask(rawCostUsd: number): number {
  if (!Number.isFinite(rawCostUsd) || rawCostUsd <= 0) return MIN_CREDITS_PER_AI_TASK;
  return Math.max(MIN_CREDITS_PER_AI_TASK, Math.ceil(rawCostUsd * CREDITS_PER_DOLLAR));
}

export function billableUsdForAiTask(rawCostUsd: number): number {
  return usdForCredits(billableCreditsForAiTask(rawCostUsd));
}

export const PLAN_CREDITS: Record<BillingPlanId, number> = {
  free: creditsForUsd(PLAN_AI_BUDGETS.free),
  starter: creditsForUsd(PLAN_AI_BUDGETS.starter),
  pro: creditsForUsd(PLAN_AI_BUDGETS.pro),
  business: creditsForUsd(PLAN_AI_BUDGETS.business),
};

export function creditsForPlan(planId: string | undefined): number {
  return creditsForUsd(aiBudgetForPlan(planId));
}

/**
 * One-time purchasable credit packs (kind: "one_time" billing plans, id
 * "credits_<packId>"). `credits` is the ADDED allowance for the current
 * billing cycle (redeemable at CREDITS_PER_DOLLAR, same as included credits);
 * `priceUsd` is what the customer pays — priced above raw cost so Rizly keeps
 * a margin even if the whole pack is spent. Top-ups apply to the current
 * calendar-month cycle only; they do not carry over into the next cycle.
 */
export const CREDIT_PACKS = {
  credits_1000: { credits: 1000, priceUsd: 10 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function isCreditPackId(value: string): value is CreditPackId {
  return value in CREDIT_PACKS;
}
