import { describe, expect, it } from "vitest";
import {
  AgentPlanRevisionError,
  completePlanWithEvidence,
  revisePlanWithPatch,
  type AgentPlan,
} from "./agent-plan.repository";

function plan(): AgentPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    request: "Check a refund and send an alert",
    goal: "Handle the refund",
    status: "active",
    steps: [
      {
        id: "check",
        task: "Check the refund",
        tool: "paypal_snapshot",
        status: "completed",
        evidence: "paypal_snapshot: ok",
      },
      {
        id: "alert",
        task: "Send the alert",
        tool: "twilio_send",
        status: "pending",
      },
      {
        id: "answer",
        task: "Summarize the result",
        status: "pending",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("completePlanWithEvidence", () => {
  it("does not convert an unexecuted tool step into final-synthesis success", () => {
    const completed = completePlanWithEvidence(plan());

    expect(completed.status).toBe("active");
    expect(completed.steps.find((step) => step.id === "alert")?.status).toBe(
      "pending",
    );
    expect(
      completed.steps.find((step) => step.id === "alert")?.evidence,
    ).toBeUndefined();
    expect(completed.steps.find((step) => step.id === "answer")?.status).toBe(
      "completed",
    );
  });

  it("does not mark a blocked tool step complete during final synthesis", () => {
    const blocked = plan();
    blocked.steps[1] = {
      ...blocked.steps[1]!,
      status: "blocked",
      evidence: "twilio_send: transient_error",
      attempts: 1,
    };

    const completed = completePlanWithEvidence(blocked);

    expect(completed.status).toBe("active");
    expect(completed.steps.find((step) => step.id === "alert")?.status).toBe(
      "blocked",
    );
  });

  it("pivots only the invalid remainder and preserves completed evidence", () => {
    const blocked = plan();
    blocked.steps[1] = {
      ...blocked.steps[1]!,
      status: "blocked",
      evidence: "twilio_send: forbidden",
      attempts: 1,
    };

    const revised = revisePlanWithPatch(
      blocked,
      {
        reason: "SMS delivery is forbidden; use the approved email channel",
        supersedeStepIds: ["alert", "answer"],
        steps: [
          {
            id: "email-alert",
            task: "Send the alert by email",
            tool: "send_email",
          },
          {
            id: "revised-answer",
            task: "Summarize the fallback result",
          },
        ],
      },
      "2026-01-01T00:01:00.000Z",
    );

    expect(revised.revision).toBe(2);
    expect(revised.pivotCount).toBe(1);
    expect(revised.goal).toBe(blocked.goal);
    expect(revised.steps.find((step) => step.id === "check")).toMatchObject({
      status: "completed",
      evidence: "paypal_snapshot: ok",
    });
    expect(revised.steps.find((step) => step.id === "alert")?.status).toBe(
      "superseded",
    );
    expect(
      revised.steps.find((step) => step.id === "email-alert")?.status,
    ).toBe("pending");
    expect(revised.revisions?.at(-1)).toMatchObject({
      supersededStepIds: ["alert", "answer"],
      addedStepIds: ["email-alert", "revised-answer"],
    });
  });

  it("rejects a pivot that tries to rewrite completed history", () => {
    expect(() =>
      revisePlanWithPatch(plan(), {
        reason: "rewrite history",
        supersedeStepIds: ["check"],
        steps: [
          { id: "check-again", task: "Check again", tool: "paypal_snapshot" },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AgentPlanRevisionError>>({
        code: "COMPLETED_STEP_IMMUTABLE",
      }),
    );
  });

  it("enforces the bounded pivot budget", () => {
    const exhausted = plan();
    exhausted.pivotCount = 2;

    expect(() =>
      revisePlanWithPatch(exhausted, {
        reason: "try a third path",
        supersedeStepIds: ["alert"],
        steps: [{ id: "third-path", task: "Try again", tool: "send_email" }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AgentPlanRevisionError>>({
        code: "PIVOT_BUDGET_EXHAUSTED",
      }),
    );
  });
});
