import { describe, expect, it } from "vitest";
import type { AgentPlan } from "../planning/agent-plan.repository";
import { AgentPlanSupervisorService } from "../planning/agent-plan-supervisor.service";
import { AgentFinalVerifierService } from "./agent-final-verifier.service";

function blockedPlan(): AgentPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    request: "Send the update",
    goal: "Send the update",
    status: "active",
    steps: [
      {
        id: "send",
        task: "Send the update",
        tool: "send_email",
        status: "blocked",
        attempts: 1,
        evidence: "send_email: transient_error",
      },
    ],
    revision: 1,
    pivotCount: 0,
    revisions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("AgentFinalVerifierService", () => {
  it("vetoes final success when a planned tool remains blocked", async () => {
    let judgeCalls = 0;
    const verifier = new AgentFinalVerifierService(
      {
        complete: async () => {
          judgeCalls += 1;
          return '{"verdict":"accept","issues":[]}';
        },
      } as never,
      new AgentPlanSupervisorService(),
    );

    const result = await verifier.verify({
      request: "Send the update",
      proposedReply: "The update was sent.",
      userId: "user-1",
      plan: blockedPlan(),
      toolResults: [
        {
          tool: "send_email",
          status: "transient_error",
          message: "Timed out",
        },
      ],
      planComplete: true,
    });

    expect(result.verdict).toBe("continue");
    expect(result.issues[0]).toContain("blocked");
    expect(judgeCalls).toBe(0);
  });

  it("honors semantic goal/evidence criticism after deterministic checks pass", async () => {
    const verifier = new AgentFinalVerifierService(
      {
        complete: async () =>
          '{"verdict":"continue","issues":["Reply claims an email was sent without evidence"]}',
      } as never,
      new AgentPlanSupervisorService(),
    );

    const result = await verifier.verify({
      request: "Explain the proposal",
      proposedReply: "I sent the proposal.",
      userId: "user-1",
      toolResults: [],
    });

    expect(result).toEqual({
      verdict: "continue",
      issues: ["Reply claims an email was sent without evidence"],
    });
  });
});
