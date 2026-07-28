import { describe, expect, it } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { createAutomationTool, describeAutomationEventTool } from "./automation.tools";

const context: HeyRizRuntimeContext = {
  userId: "owner@example.com",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: {
    connected: false,
    calendarConnected: false,
    inboxConnected: false,
    calendarStatus: "not_connected",
    inboxStatus: "not_connected",
    checkedAt: new Date(0).toISOString(),
    schedule: [],
    unread: [],
  },
  honorific: "sir",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

describe("describe_automation_event", () => {
  it("returns the JSON Schema for a live event's config", async () => {
    const result = await describeAutomationEventTool.execute({
      userId: context.userId,
      payload: { app: "discord", kind: "trigger", event: "New Message" },
      context,
    });

    expect(result.status).toBe("ok");
    const data = result.data as { configSchema: { properties?: Record<string, unknown> } | null };
    // Discord's trigger is the case that motivated this tool — the model can't
    // guess channelId, so it has to be discoverable before create_automation.
    expect(data.configSchema?.properties).toHaveProperty("channelId");
  });

  it("says so plainly when an event needs no config at all", async () => {
    const result = await describeAutomationEventTool.execute({
      userId: context.userId,
      payload: { app: "telegram", kind: "trigger", event: "New Message" },
      context,
    });

    expect(result.status).toBe("ok");
    expect(result.message).toContain("no config");
  });

  it("rejects an app/event combo that isn't live, and lists what is", async () => {
    const result = await describeAutomationEventTool.execute({
      userId: context.userId,
      payload: { app: "myspace", kind: "trigger", event: "New Poke" },
      context,
    });

    expect(result.status).toBe("invalid_input");
    expect(result.message).toContain("Supported triggers");
  });
});

describe("create_automation config validation", () => {
  it("advertises the live catalog in its description so the model doesn't guess", () => {
    const tool = createAutomationTool();

    expect(tool.description).toContain("Supported triggers");
    expect(tool.description).toContain("github");
  });

  it("refuses a step with missing config and hands back the schema to fix it", async () => {
    const tool = createAutomationTool();

    const result = await tool.execute({
      userId: context.userId,
      payload: {
        name: "GitHub issues to Telegram",
        // channelId omitted — exactly what a blind model produces today.
        trigger: { app: "discord", event: "New Message", config: {} },
        actions: [{ app: "telegram", event: "Notify Me", config: { message: "hi" } }],
      },
      context,
    });

    expect(result.status).toBe("invalid_input");
    const data = result.data as { configSchema?: unknown; issues?: unknown[] };
    expect(data.configSchema).toBeDefined();
    expect(data.issues?.length).toBeGreaterThan(0);
  });

  it("still rejects a non-live app before it ever reaches config validation", async () => {
    const tool = createAutomationTool();

    const result = await tool.execute({
      userId: context.userId,
      payload: {
        name: "nope",
        trigger: { app: "myspace", event: "New Poke" },
        actions: [{ app: "telegram", event: "Notify Me" }],
      },
      context,
    });

    expect(result.status).toBe("invalid_input");
    expect(result.message).toContain("isn't a live trigger");
  });
});
