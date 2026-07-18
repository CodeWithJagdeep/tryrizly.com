import { describe, expect, it } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { createSourceUpdatesTool } from "./source-updates.tools";

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
  honorific: "boss",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

describe("source_updates tool", () => {
  it("orders cross-source evidence and remembers what was already reported", async () => {
    const now = Date.now();
    const connectors = {
      getSlackSecret: async () => ({ botToken: "xoxb-test" }),
      getDiscordSecret: async () => null,
      getNotionSecret: async () => null,
    };
    const slack = {
      getRecentMessages: async () => [
        {
          ts: String(Math.floor((now - 60_000) / 1000)),
          text: "Launch announcement is live",
          channel: "announcements",
          channelId: "C1",
          userName: "Asha",
          permalink: "https://slack.test/message",
        },
      ],
    };
    const google = {
      listThreads: async () => ({ connected: false as const, reason: "not_connected" as const }),
      listEvents: async () => ({
        connected: true as const,
        events: [
          {
            id: "event-1",
            title: "Announcement review",
            description: "Final launch review",
            start: new Date(now - 3_600_000).toISOString(),
            allDay: false,
            attendees: [],
          },
        ],
      }),
    };
    const seen = new Map<string, string>();
    const receipts = {
      classifyAndMark: async (_userId: string, evidence: Array<{ key: string; title: string }>) =>
        evidence.map((item) => {
          const hash = item.title;
          const old = seen.get(item.key);
          seen.set(item.key, hash);
          return {
            ...item,
            deliveryState: !old ? "new" as const : old === hash ? "already_reported" as const : "updated" as const,
          };
        }),
    };
    const tool = createSourceUpdatesTool(
      connectors as never,
      google as never,
      slack as never,
      {} as never,
      {} as never,
      receipts as never,
    );

    const first = await tool.execute({
      userId: context.userId,
      payload: { query: "announcement", sources: ["slack", "calendar"] },
      context,
    });
    const firstData = first.data as {
      evidence: Array<{ source: string; deliveryState: string }>;
      counts: { new: number; alreadyReported: number };
    };
    expect(firstData.evidence.map((item) => item.source)).toEqual(["slack", "calendar"]);
    expect(firstData.counts).toMatchObject({ new: 2, alreadyReported: 0 });

    const second = await tool.execute({
      userId: context.userId,
      payload: { query: "announcement", sources: ["slack", "calendar"] },
      context,
    });
    const secondData = second.data as { counts: { new: number; alreadyReported: number } };
    expect(secondData.counts).toMatchObject({ new: 0, alreadyReported: 2 });
    expect(second.message).toContain("ALREADY REPORTED");
  });
});
