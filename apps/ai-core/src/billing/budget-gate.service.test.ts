import { describe, expect, it, vi } from "vitest";
import { BudgetGateService } from "./budget-gate.service";

describe("BudgetGateService", () => {
  it("blocks the internal free state even when credit top-ups remain", async () => {
    const planBudget = {
      getCycleWindow: vi.fn().mockResolvedValue({
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: null,
      }),
      getPlanId: vi.fn().mockResolvedValue("free"),
      aiBudgetUsd: vi.fn().mockResolvedValue(5),
      previousRolloverCycleStart: vi.fn().mockResolvedValue(undefined),
      rolloverCreditsForCycle: vi.fn().mockResolvedValue(0),
    };
    const usageLedger = {
      spendSince: vi.fn().mockResolvedValue(0),
    };
    const gate = new BudgetGateService(planBudget as never, usageLedger as never);

    await expect(gate.check("user@example.com")).resolves.toMatchObject({
      state: "exceeded",
      ratio: 1,
      rolloverCredits: 0,
    });
  });
});
