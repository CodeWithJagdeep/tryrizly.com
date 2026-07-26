import { describe, expect, it, vi } from "vitest";
import { BudgetGateService } from "./budget-gate.service";

describe("BudgetGateService", () => {
  // Free is now a real, budgeted tier (see PLAN_AI_BUDGETS.free in
  // shared/src/billing/plan-budgets.ts) rather than an always-blocked
  // internal state — a free user with unspent budget should read "ok" like
  // any other plan.
  it("allows the free plan when it still has budget left", async () => {
    const planBudget = {
      getCycleWindow: vi.fn().mockResolvedValue({
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: null,
      }),
      getPlanId: vi.fn().mockResolvedValue("free"),
      aiBudgetUsd: vi.fn().mockResolvedValue(0.75),
      previousRolloverCycleStart: vi.fn().mockResolvedValue(undefined),
      rolloverCreditsForCycle: vi.fn().mockResolvedValue(0),
    };
    const usageLedger = {
      spendSince: vi.fn().mockResolvedValue(0),
    };
    const gate = new BudgetGateService(planBudget as never, usageLedger as never);

    await expect(gate.check("user@example.com")).resolves.toMatchObject({
      state: "ok",
      ratio: 0,
      rolloverCredits: 0,
    });
  });

  it("blocks the free plan once its budget is used up", async () => {
    const planBudget = {
      getCycleWindow: vi.fn().mockResolvedValue({
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: null,
      }),
      getPlanId: vi.fn().mockResolvedValue("free"),
      aiBudgetUsd: vi.fn().mockResolvedValue(0.75),
      previousRolloverCycleStart: vi.fn().mockResolvedValue(undefined),
      rolloverCreditsForCycle: vi.fn().mockResolvedValue(0),
    };
    const usageLedger = {
      spendSince: vi.fn().mockResolvedValue(0.75),
    };
    const gate = new BudgetGateService(planBudget as never, usageLedger as never);

    await expect(gate.check("user@example.com")).resolves.toMatchObject({
      state: "exceeded",
      ratio: 1,
      rolloverCredits: 0,
    });
  });
});
