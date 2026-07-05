import { describe, expect, it } from "vitest";
import {
  aiBudgetForPlan,
  CREDIT_PACKS,
  creditsForPlan,
  creditsForUsd,
  isBillingPlanId,
  isCreditPackId,
  PLAN_AI_BUDGETS,
  PLAN_CREDITS,
  usdForCredits,
} from "./plan-budgets";

describe("credits conversion", () => {
  it("converts USD to credits at the fixed rate (200 credits per dollar)", () => {
    expect(creditsForUsd(1)).toBe(200);
    expect(creditsForUsd(0.5)).toBe(100);
    expect(creditsForUsd(0)).toBe(0);
  });

  it("round-trips usdForCredits against creditsForUsd", () => {
    for (const usd of [0.005, 1, 6, 17, 40]) {
      expect(usdForCredits(creditsForUsd(usd))).toBeCloseTo(usd, 5);
    }
  });

  it("rounds fractional-cent spend to the nearest whole credit, never negative", () => {
    // A single cheap LLM call costing $0.0001 should round to 0 credits, not
    // throw or go negative — this is exactly the "-0 credits" case a user
    // flagged mid-session before the per-day aggregation fix.
    expect(creditsForUsd(0.0001)).toBe(0);
    expect(creditsForUsd(0.0001)).toBeGreaterThanOrEqual(0);
  });
});

describe("plan budgets", () => {
  it("has a PLAN_CREDITS entry derived from PLAN_AI_BUDGETS for every plan", () => {
    for (const planId of Object.keys(PLAN_AI_BUDGETS) as (keyof typeof PLAN_AI_BUDGETS)[]) {
      expect(PLAN_CREDITS[planId]).toBe(creditsForUsd(PLAN_AI_BUDGETS[planId]));
    }
  });

  it("degrades an unknown/missing plan id to the Free budget, never unlimited", () => {
    expect(aiBudgetForPlan(undefined)).toBe(PLAN_AI_BUDGETS.free);
    expect(aiBudgetForPlan("some_deleted_plan")).toBe(PLAN_AI_BUDGETS.free);
    expect(aiBudgetForPlan("starter")).toBe(PLAN_AI_BUDGETS.starter);
  });

  it("recognizes only the real plan ids", () => {
    expect(isBillingPlanId("starter")).toBe(true);
    expect(isBillingPlanId("credits_1000")).toBe(false);
    expect(isBillingPlanId("business")).toBe(true);
  });

  it("creditsForPlan matches PLAN_CREDITS for a known plan and Free for an unknown one", () => {
    expect(creditsForPlan("business")).toBe(PLAN_CREDITS.business);
    expect(creditsForPlan("nonexistent")).toBe(PLAN_CREDITS.free);
  });
});

describe("credit packs", () => {
  it("only recognizes ids that are actually defined in CREDIT_PACKS", () => {
    for (const packId of Object.keys(CREDIT_PACKS)) {
      expect(isCreditPackId(packId)).toBe(true);
    }
    expect(isCreditPackId("starter")).toBe(false);
    expect(isCreditPackId("credits_9999")).toBe(false);
  });

  it("prices every pack above its own raw redemption cost (top-ups must carry margin)", () => {
    for (const pack of Object.values(CREDIT_PACKS)) {
      const redemptionValueUsd = usdForCredits(pack.credits);
      expect(pack.priceUsd).toBeGreaterThan(redemptionValueUsd);
    }
  });
});
