import { describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service";
import type {
  BillingPurchaseRecord,
  BillingTrialRecord,
} from "./types";

function createService(input: {
  trial?: BillingTrialRecord | null;
  purchase?: BillingPurchaseRecord | null;
} = {}) {
  const repository = {
    findTrial: vi.fn().mockResolvedValue(input.trial ?? null),
    findCurrentSubscription: vi.fn().mockResolvedValue(null),
    findCurrentPurchase: vi.fn().mockResolvedValue(input.purchase ?? null),
  };
  const razorpay = { configured: vi.fn().mockReturnValue(false) };
  return new BillingService(repository as never, razorpay as never);
}

describe("BillingService access", () => {
  it("blocks product access when no trial or paid plan is active", async () => {
    const result = await createService().status({ userId: "user@example.com" });

    expect(result.access).toEqual({
      active: false,
      state: "free",
      expiresAt: null,
    });
  });

  it("keeps access active during an unexpired trial", async () => {
    const trial: BillingTrialRecord = {
      user_id: "user@example.com",
      plan_id: "business",
      started_at: new Date(Date.now() - 60_000),
      ends_at: new Date(Date.now() + 60_000),
      consumed: false,
    };

    const result = await createService({ trial }).status({ userId: trial.user_id });

    expect(result.access.active).toBe(true);
    expect(result.access.state).toBe("trialing");
  });

  it("blocks access after the trial expiration timestamp", async () => {
    const trial: BillingTrialRecord = {
      user_id: "user@example.com",
      plan_id: "business",
      started_at: new Date(Date.now() - 120_000),
      ends_at: new Date(Date.now() - 60_000),
      consumed: false,
    };

    const result = await createService({ trial }).status({ userId: trial.user_id });

    expect(result.access.active).toBe(false);
    expect(result.access.state).toBe("free");
  });

  it("does not let a credit top-up unlock an expired account", async () => {
    const now = new Date();
    const purchase: BillingPurchaseRecord = {
      id: "purchase-1",
      user_id: "user@example.com",
      plan_id: "credits_1000",
      provider: "razorpay",
      amount: 1000,
      currency: "USD",
      status: "paid",
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    const result = await createService({ purchase }).status({ userId: purchase.user_id });

    expect(result.access.active).toBe(false);
    expect(result.plan.id).toBe("free");
  });
});
