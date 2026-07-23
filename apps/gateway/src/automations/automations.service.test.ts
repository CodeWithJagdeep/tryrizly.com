import { describe, expect, it, vi } from "vitest";
import type { AutomationFlow } from "@heyriz/shared/automations/types";
import {
  validateAutomationFlowForActivation,
  validateAutomationReleasePolicy,
} from "@heyriz/shared/automations/schemas";
import { AutomationsService } from "./automations.service";

function flow(overrides: Partial<AutomationFlow> = {}): AutomationFlow {
  return {
    id: "flow-1",
    userId: "user-1",
    name: "Important email alert",
    status: "draft",
    steps: [
      {
        id: "trigger",
        kind: "trigger",
        app: "gmail",
        title: "New Email Matching Search",
        config: { query: "is:unread from:billing@example.com" },
      },
      {
        id: "notify",
        kind: "action",
        app: "telegram",
        title: "Notify Me",
        config: { message: "Important email from {{from}}: {{subject}}" },
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("automation activation contract", () => {
  it("rejects missing required action configuration and unknown keys", () => {
    const candidate = flow({
      steps: [
        flow().steps[0],
        {
          id: "notify",
          kind: "action",
          app: "telegram",
          title: "Notify Me",
          config: { unexpected: "value" },
        },
      ],
    });

    const result = validateAutomationFlowForActivation(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(["message", "config"]),
      );
    }
  });

  it("activates only a fully schema-valid flow", async () => {
    const candidate = flow();
    const repo = {
      getFlow: vi.fn().mockResolvedValue(candidate),
      setStatus: vi.fn().mockResolvedValue({ ...candidate, status: "active" }),
    };
    const service = new AutomationsService(repo as never);

    await expect(service.activate(candidate.userId, candidate.id)).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(repo.setStatus).toHaveBeenCalledWith(candidate.userId, candidate.id, "active");
  });

  it("keeps payment actions behind the expanded release tier", () => {
    const candidate = flow({
      steps: [
        flow().steps[0],
        {
          id: "customer",
          kind: "action",
          app: "stripe",
          title: "Create Customer",
          config: { email: "{{from}}" },
        },
      ],
    });

    expect(validateAutomationReleasePolicy(candidate, "safe")).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(validateAutomationReleasePolicy(candidate, "expanded")).toEqual({ ok: true });
  });

  it("pauses an active flow when an edit makes its definition invalid", async () => {
    const candidate = flow({ status: "active" });
    const repo = {
      getFlow: vi.fn().mockResolvedValue(candidate),
      upsertFlow: vi.fn().mockImplementation(
        async (_userId: string, input: Record<string, unknown>) => ({
          ...candidate,
          ...input,
        }),
      ),
    };
    const service = new AutomationsService(repo as never);

    await service.save(candidate.userId, {
      id: candidate.id,
      name: candidate.name,
      steps: [
        candidate.steps[0],
        { ...candidate.steps[1], config: {} },
      ],
    });

    expect(repo.upsertFlow).toHaveBeenCalledWith(
      candidate.userId,
      expect.objectContaining({ status: "paused" }),
    );
  });
});
