import { describe, expect, it } from "vitest";
import { completePlanWithEvidence, type AgentPlan } from "./agent-plan.repository";

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
    expect(completed.steps.find((step) => step.id === "alert")?.status).toBe("pending");
    expect(completed.steps.find((step) => step.id === "alert")?.evidence).toBeUndefined();
    expect(completed.steps.find((step) => step.id === "answer")?.status).toBe("completed");
  });
});
