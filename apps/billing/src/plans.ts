import { env } from "@heyriz/shared/env";
import { PLAN_AI_BUDGETS } from "@heyriz/shared/billing/plan-budgets";
import type { BillingPlan } from "./types";

const currency = "USD";

export function billingPlans(): BillingPlan[] {
  return [
    {
      id: "free",
      name: "Free",
      kind: "free",
      description:
        "7-day full-feature trial, then choose a plan. This is also the floor tier afterward if you don't convert.",
      currency,
      amount: 0,
      trialDays: 0,
      aiBudgetUsd: PLAN_AI_BUDGETS.free,
      seats: 1,
      features: ["Limited chat", "Basic memory", "Manual connector setup"],
    },
    {
      id: "starter",
      name: "Starter",
      kind: "subscription",
      description: "Founder-grade daily assistant with controlled background AI.",
      currency,
      amount: 4900,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.starter,
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
      intro: env.RAZORPAY_STARTER_INTRO_OFFER_ID ? { amount: 1500, months: 3 } : undefined,
    },
    {
      id: "pro",
      name: "Pro",
      kind: "subscription",
      description: "Heavier inbox, meetings, and proactive workflow automation.",
      currency,
      amount: 9900,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.pro,
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
      amount: 19900,
      interval: "month",
      trialDays: env.BILLING_TRIAL_DAYS,
      aiBudgetUsd: PLAN_AI_BUDGETS.business,
      seats: 1,
      features: [
        "Recurring subscription",
        `${env.BILLING_TRIAL_DAYS}-day trial`,
        "Higher AI budget",
      ],
      razorpayPlanId: env.RAZORPAY_BUSINESS_PLAN_ID,
    },
  ];
}

export function findPlan(planId: string) {
  return billingPlans().find((plan) => plan.id === planId);
}
