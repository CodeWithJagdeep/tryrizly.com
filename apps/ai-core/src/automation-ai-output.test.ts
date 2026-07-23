import { describe, expect, it } from "vitest";
import { validateAutomationAiOutput } from "./ai-core.service";

describe("automation AI output contract", () => {
  it("fails closed when a boolean decision includes prose", () => {
    expect(validateAutomationAiOutput("Yes, send the alert", "boolean")).toEqual({
      ok: false,
      error: "ai_step_invalid_boolean_output",
    });
  });

  it("accepts and canonicalizes schema-shaped JSON output", () => {
    expect(validateAutomationAiOutput(' { "priority": "high", "score": 0.91 } ', "json")).toEqual({
      ok: true,
      output: '{"priority":"high","score":0.91}',
    });
  });

  it("rejects non-finite numeric output", () => {
    expect(validateAutomationAiOutput("Infinity", "number")).toEqual({
      ok: false,
      error: "ai_step_invalid_number_output",
    });
  });
});
