import { env } from "@heyriz/shared/env";
import { CREDIT_PACKS, PLAN_AI_BUDGETS, PLAN_CREDITS } from "@heyriz/shared/billing/plan-budgets";
import type { BillingPlan } from "./types";

const currency = "USD";

export function billingPlans(): BillingPlan[] {
  return [
    {
      id: "free",
      name: "Free",
      kind: "free",
      // Not a marketed/selectable plan — this is the internal fallback state
      // for an account with no active trial/subscription/purchase (post-trial
      // floor, or pre-trial before signup completes). requirePlan("free") in
      // billing.service.ts depends on this entry existing; don't remove it.
      description: "Upgrade required after the trial ends.",
      currency,
      amount: 0,
      trialDays: 0,
      aiBudgetUsd: PLAN_AI_BUDGETS.free,
      credits: PLAN_CREDITS.free,
      seats: 1,
      features: ["Upgrade required"],
    },
    {
      id: "starter",
      name: "Starter",
      kind: "subscription",
      description: "Founder-grade daily assistant with controlled background AI.",
      currency,
      amount: 2000,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.starter,
      credits: PLAN_CREDITS.starter,
      seats: 1,
      features: [
        "Recurring subscription",
        `${env.BILLING_TRIAL_DAYS}-day trial`,
        "Email triage",
        "Connector memory",
      ],
      razorpayPlanId: env.RAZORPAY_STARTER_PLAN_ID,
      // Advertised only when the Razorpay offer actually backing it exists,
      // so the shown price can never drift from what gets charged.
      intro: env.RAZORPAY_STARTER_INTRO_OFFER_ID ? { amount: 1000, months: 1 } : undefined,
    },
    {
      id: "pro",
      name: "Pro",
      kind: "subscription",
      description: "Heavier inbox, meetings, and proactive workflow automation.",
      currency,
      amount: 4900,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.pro,
      credits: PLAN_CREDITS.pro,
      seats: 1,
      features: [
        "Recurring subscription",
        `${env.BILLING_TRIAL_DAYS}-day trial`,
        "Priority agent runs",
        "Digest automation",
      ],
      razorpayPlanId: env.RAZORPAY_PRO_PLAN_ID,
    },
    {
      id: "business",
      name: "Business",
      kind: "subscription",
      description: "Higher budget plan for deeper background work.",
      currency,
      amount: 10000,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.business,
      credits: PLAN_CREDITS.business,
      seats: 1,
      features: [
        "Recurring subscription",
        `${env.BILLING_TRIAL_DAYS}-day trial`,
        "Higher AI budget",
      ],
      razorpayPlanId: env.RAZORPAY_BUSINESS_PLAN_ID,
    },
    ...creditPackPlans(),
  ];
}

/** One-time credit top-up packs — purchasable by any paid or free user to extend the current cycle's AI budget. */
function creditPackPlans(): BillingPlan[] {
  return Object.entries(CREDIT_PACKS).map(([packId, pack]) => ({
    id: packId,
    name: `${pack.credits.toLocaleString()} credits`,
    kind: "one_time",
    description: "Top up your AI credits for the rest of this billing cycle.",
    currency,
    amount: pack.priceUsd * 100,
    trialDays: 0,
    aiBudgetUsd: 0,
    credits: pack.credits,
    seats: 1,
    features: [`+${pack.credits.toLocaleString()} credits`, "Applies to your current cycle"],
  }));
}

export function findPlan(planId: string) {
  return billingPlans().find((plan) => plan.id === planId);
}
