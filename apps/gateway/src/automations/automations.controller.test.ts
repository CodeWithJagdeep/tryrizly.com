import { describe, expect, it, vi } from "vitest";
import { env } from "@heyriz/shared/env";
import type {
  AutomationFlow,
  AutomationRun,
  AutomationRunAuditEvent,
} from "@heyriz/shared/automations/types";
import { AutomationsController } from "./automations.controller";

function flow(): AutomationFlow {
  return {
    id: "flow_1",
    userId: "user_1",
    name: "Pay invoice",
    status: "active",
    steps: [
      {
        id: "fetch",
        kind: "trigger",
        app: "gmail",
        title: "New Email Matching Search",
        config: { query: "subject:invoice", account: "private-account" },
      },
      {
        id: "pay",
        kind: "action",
        app: "stripe",
        title: "Create Customer",
        config: { email: "{{from}}", account: "private-stripe-account" },
      },
    ],
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

function controller(repo: Record<string, unknown>) {
  return new AutomationsController({} as never, repo as never, {} as never);
}

const secret = env.AUTH_INTERNAL_SECRET;

describe("automation run audit persistence", () => {
  it("locks a secret-free original plan and trigger receipt before execution", async () => {
    const repo = {
      getFlow: vi.fn().mockResolvedValue(flow()),
      createRun: vi.fn().mockImplementation(async (run: Omit<AutomationRun, "id">) => ({
        ...run,
        id: "run_1",
      })),
    };

    const result = await controller(repo).internalCreateRun(secret, {
      flowId: "flow_1",
      userId: "user_1",
      triggerItemId: "message_123",
      triggerPayload: { subject: "Invoice" },
    });

    expect(result.run?.originalPlan).toEqual([
      {
        id: "fetch",
        kind: "trigger",
        app: "gmail",
        title: "New Email Matching Search",
      },
      {
        id: "pay",
        kind: "action",
        app: "stripe",
        title: "Create Customer",
      },
    ]);
    expect(JSON.stringify(result.run?.originalPlan)).not.toContain("private-account");
    expect(result.run?.auditTrail).toEqual([
      expect.objectContaining({ type: "plan_created", stepIds: ["fetch", "pay"] }),
      expect.objectContaining({
        type: "step_succeeded",
        stepId: "fetch",
        evidence: expect.objectContaining({
          provider: "gmail",
          resourceId: "message_123",
        }),
      }),
    ]);
  });

  it("retains earlier evidence and appends an authoritative final verifier", async () => {
    const retained: AutomationRunAuditEvent[] = [
      {
        id: "plan:1",
        at: "2026-07-24T00:00:00.000Z",
        revision: 1,
        type: "plan_created",
        stepIds: ["fetch", "pay"],
      },
      {
        id: "trigger:1",
        at: "2026-07-24T00:00:00.000Z",
        revision: 1,
        type: "step_succeeded",
        stepId: "fetch",
        evidence: {
          kind: "control",
          provider: "gmail",
          acknowledged: true,
          resourceId: "message_123",
        },
      },
    ];
    const repo = {
      getRun: vi.fn().mockResolvedValue({
        id: "run_1",
        userId: "user_1",
        auditTrail: retained,
      }),
      finishRun: vi.fn().mockResolvedValue(true),
    };
    const payEvidence = {
      kind: "provider_ack" as const,
      provider: "paypal",
      acknowledged: true as const,
      resourceId: "payment_123",
    };
    const pivot: AutomationRunAuditEvent = {
      id: "run_1:2",
      at: "2026-07-24T00:00:02.000Z",
      revision: 2,
      type: "plan_revised",
      reason: "Stripe returned a rate limit, so the approved PayPal fallback was selected.",
      supersededStepIds: ["pay"],
      preservedStepIds: ["fetch"],
      replacementSteps: [
        {
          id: "pay-paypal",
          kind: "action",
          app: "paypal",
          title: "Pay invoice",
        },
      ],
    };

    await expect(
      controller(repo).internalFinishRun(
        secret,
        {
          userId: "user_1",
          status: "success",
          stepResults: [
            {
              stepId: "pay-paypal",
              app: "paypal",
              status: "success",
              evidence: payEvidence,
            },
          ],
          auditTrail: [
            retained[0],
            pivot,
            {
              id: "run_1:3",
              at: "2026-07-24T00:00:03.000Z",
              revision: 2,
              type: "step_succeeded",
              stepId: "pay-paypal",
              evidence: payEvidence,
            },
          ],
        },
        "run_1",
      ),
    ).resolves.toEqual({ ok: true });

    const patch = vi.mocked(repo.finishRun).mock.calls[0][2] as Pick<
      AutomationRun,
      "auditTrail"
    >;
    expect(patch.auditTrail?.filter((event) => event.id === "plan:1")).toHaveLength(1);
    expect(patch.auditTrail).toEqual(
      expect.arrayContaining([
        retained[1],
        pivot,
        expect.objectContaining({
          type: "final_verification",
          result: "passed",
          method: "deterministic_evidence",
          revision: 2,
        }),
      ]),
    );
  });

  it("does not let a failed run omit its failure event", async () => {
    const repo = {
      getRun: vi.fn(),
      finishRun: vi.fn(),
    };

    await expect(
      controller(repo).internalFinishRun(
        secret,
        {
          userId: "user_1",
          status: "failed",
          stepResults: [{ stepId: "pay", app: "stripe", status: "skipped" }],
        },
        "run_1",
      ),
    ).resolves.toEqual({ ok: false, error: "failed_run_requires_a_failed_step" });
    expect(repo.finishRun).not.toHaveBeenCalled();
  });
});
