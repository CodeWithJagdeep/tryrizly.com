import { describe, expect, it } from "vitest";
import { ContextService } from "./context.service";

describe("ContextService scoped loading", () => {
  it("fetches only the live inbox for an email route", async () => {
    let memoryCalls = 0;
    let connectorCalls = 0;
    let calendarCalls = 0;
    let inboxCalls = 0;
    const service = new ContextService(
      {
        search: async () => {
          memoryCalls += 1;
          return [];
        },
      } as never,
      preferences() as never,
      {
        list: async () => {
          connectorCalls += 1;
          return [];
        },
      } as never,
      {
        listEvents: async () => {
          calendarCalls += 1;
          return { connected: true, events: [] };
        },
        listThreads: async () => {
          inboxCalls += 1;
          return {
            connected: true,
            messages: [
              {
                from: "Priya <priya@example.com>",
                subject: "Launch review",
              },
            ],
          };
        },
      } as never,
    );

    const context = await service.build(
      {
        userId: "u1",
        source: "telegram",
        message: "Check my inbox",
      },
      { scopes: ["live_inbox"] },
    );

    expect(inboxCalls).toBe(1);
    expect(calendarCalls).toBe(0);
    expect(memoryCalls).toBe(0);
    expect(connectorCalls).toBe(0);
    expect(context.live.inboxStatus).toBe("fresh");
    expect(context.live.unread).toEqual([
      { from: "Priya <priya@example.com>", subject: "Launch review" },
    ]);
  });

  it("keeps full context loading for legacy non-routed callers", async () => {
    let memoryCalls = 0;
    let connectorCalls = 0;
    const service = new ContextService(
      {
        search: async () => {
          memoryCalls += 1;
          return [];
        },
      } as never,
      preferences() as never,
      {
        list: async () => {
          connectorCalls += 1;
          return [];
        },
      } as never,
      {
        listEvents: async () => ({ connected: false, events: [] }),
        listThreads: async () => ({ connected: false, messages: [] }),
      } as never,
    );

    await service.build({
      userId: "u1",
      source: "telegram",
      message: "legacy caller",
    });

    expect(memoryCalls).toBe(1);
    expect(connectorCalls).toBe(1);
  });
});

function preferences() {
  return {
    getTimezone: async () => "UTC",
    getHonorific: async () => "boss",
    getDisplayName: async () => "Jagdeep",
    hasExplicitTimezone: async () => true,
    getLanguage: async () => undefined,
  };
}
