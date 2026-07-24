import { describe, expect, it } from "vitest";
import { AgentGuardrailService } from "./agent-guardrail.service";

describe("AgentGuardrailService", () => {
  it("detects model-authored observations with impossible runtime statuses", () => {
    const guardrails = new AgentGuardrailService({} as never);

    expect(
      guardrails.looksLikeFabricatedObservation(
        '{"tool":"send_email","status":"success","message":"sent"}',
      ),
    ).toBe(true);
    expect(
      guardrails.looksLikeFabricatedObservation(
        '{"action":"tool","tool_name":"send_email","tool_input":{}}',
      ),
    ).toBe(false);
  });

  it("uses the semantic judge for long, novel zero-tool promises", async () => {
    let calls = 0;
    const guardrails = new AgentGuardrailService({
      complete: async () => {
        calls += 1;
        return "YES";
      },
    } as never);
    const promise =
      "Your request has entered my workflow and remains in motion. I am handling every detail and will provide the completed outcome shortly. ".repeat(
        3,
      );

    await expect(
      guardrails.isStalledPromise(promise, 0, "user-1"),
    ).resolves.toBe(true);
    expect(promise.length).toBeGreaterThan(240);
    expect(calls).toBe(1);
  });
});
