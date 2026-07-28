import { describe, expect, it } from "vitest";
import { validateAutomationStepConfig } from "./schemas";
import { isEventLive, type AutomationStep } from "./types";

function step(title: string, config: Record<string, unknown>): AutomationStep {
  return { id: "s1", kind: "action", app: "slack", title, config };
}

/**
 * Guards the fix for "Send Channel Message" silently delivering to the linked
 * DM instead of the configured channel. The schema split is what forces a
 * channelId to exist at all, so these assertions are the tripwire for anyone
 * re-merging the two Slack action shapes back together.
 */
describe("slack Send Channel Message", () => {
  it("is live now that the worker actually targets a channel", () => {
    expect(isEventLive("slack", "action", "Send Channel Message")).toBe(true);
    expect(isEventLive("slack", "action", "Send Direct Message")).toBe(true);
  });

  it("requires a channelId — a message alone is not enough", () => {
    const result = validateAutomationStepConfig(step("Send Channel Message", { message: "hi" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === "channelId")).toBe(true);
    }
  });

  it("accepts a fully specified channel send", () => {
    const result = validateAutomationStepConfig(
      step("Send Channel Message", { channelId: "C123", channelName: "general", message: "hi" }),
    );

    expect(result.ok).toBe(true);
  });

  it("still lets a direct message omit any channel target", () => {
    const result = validateAutomationStepConfig(step("Send Direct Message", { message: "hi" }));

    expect(result.ok).toBe(true);
  });

  it("rejects a channelId smuggled onto the DM variant", () => {
    // .strict() — otherwise a channelId here would read as "targets a channel"
    // while the worker quietly delivers to the DM, the exact original bug.
    const result = validateAutomationStepConfig(
      step("Send Direct Message", { message: "hi", channelId: "C123" }),
    );

    expect(result.ok).toBe(false);
  });
});
