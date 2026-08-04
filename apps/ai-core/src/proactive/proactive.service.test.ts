import { beforeEach, describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  enqueueReminder: vi.fn(async () => undefined),
  enqueueNotification: vi.fn(async () => undefined),
}));

vi.mock("@heyriz/shared/queue/queues", () => queueMocks);
vi.mock("@heyriz/shared/env", () => ({
  env: {
    BACKGROUND_AI_ENABLED: true,
    DEFAULT_USER_ID: "owner@example.com",
  },
}));

import { ProactiveService, pickCorrelatedHint } from "./proactive.service";

function memory(
  id: string,
  summary: string,
  metadata: Record<string, unknown>,
) {
  return {
    id,
    summary,
    createdAt: new Date().toISOString(),
    metadata,
  };
}

function createService(
  memories: ReturnType<typeof memory>[],
  overrides: {
    events?: unknown[];
    calComBookings?: unknown[];
    calComConnected?: boolean;
  } = {},
) {
  return new ProactiveService(
    {
      execute: async () => ({ tool: "business_snapshot", status: "not_implemented", message: "Unavailable" }),
    } as never,
    {
      listEvents: async () => ({ connected: true, events: overrides.events ?? [] }),
    } as never,
    {
      getCalComSecret: async () => overrides.calComConnected
        ? { kind: "apikey", apiKey: "secret" }
        : null,
    } as never,
    {
      listBookings: async () => overrides.calComBookings ?? [],
    } as never,
    {
      listBySource: async () => memories,
      search: async () => [],
    } as never,
    {
      listOpen: async () => [],
    } as never,
    {
      getHonorific: async () => "sir",
      getTimezone: async () => "Asia/Kolkata",
    } as never,
    {
      recordEvent: async () => ({ inserted: false }),
    } as never,
    {
      extractFromMeeting: async () => undefined,
    } as never,
  );
}

describe("ProactiveService morning brief", () => {
  beforeEach(() => {
    queueMocks.enqueueReminder.mockClear();
  });

  it("keeps actionable alerts and excludes bulk or unverified email memories", async () => {
    const service = createService([
      memory(
        "godaddy",
        "Email from GoDaddy (Action required: Update your account settings): Account notice",
        {
          category: "account_alert",
          from: "GoDaddy <donotreply@e.godaddy.com>",
          subject: "Action required: Update your account settings",
          action: "update the billing contact today",
          urgency: "urgent",
          riskLevel: "high",
          isAutomated: true,
          isMarketing: false,
        },
      ),
      memory(
        "wonsulting",
        "Email from Jonathan at Wonsulting (The first 100 applicants): Cold outreach",
        {
          category: "general_medium",
          from: "Jonathan @ Wonsulting <jonathan+j@wonsulting.com>",
          subject: "The first 100 applicants",
          requiresReply: false,
          isAutomated: false,
          isMarketing: false,
        },
      ),
      memory("hirist", "Email from hirist.com (10+ Jobs Matching Your Profile): Jobs", {
        category: "newsletter",
        priority: "HIGH",
      }),
      memory("glassdoor", "Email from Glassdoor Community (Hi All): Community digest", {
        category: "general_medium",
        requiresReply: false,
        isMarketing: true,
      }),
      memory(
        "yc",
        "Email from Y Combinator: Still looking for a job? (priority: HIGH)",
        { priority: "HIGH" },
      ),
    ]);

    const result = await service.morningBrief("owner@example.com");

    expect(result.text).toContain("Good morning, sir.\n\nSchedule\nNo meetings today.");
    expect(result.text).toContain(
      "Priority inbox\n1. GoDaddy - Action required: Update your account settings.",
    );
    expect(result.text).toContain("Action: Update the billing contact today.");
    expect(result.text).toContain("Recommended next step\nUpdate the billing contact today.");
    expect(result.text).not.toMatch(/Wonsulting|hirist|Glassdoor|Y Combinator|Suggested:/);
    expect(queueMocks.enqueueReminder).toHaveBeenCalledTimes(1);
  });

  it("includes a human email only when a reply requirement was verified", async () => {
    const service = createService([
      memory("reply", "Email from Jonathan (Proposal follow-up): Reply requested", {
        category: "general_medium",
        person: "Jonathan",
        from: "Jonathan <jonathan@example.com>",
        subject: "Proposal follow-up",
        requiresReply: true,
        isAutomated: false,
        isMarketing: false,
      }),
    ]);

    const result = await service.morningBrief("owner@example.com");

    expect(result.text).toContain("Jonathan - Proposal follow-up.");
    expect(result.text).toContain("Action: Reply to Jonathan.");
  });

  it("shows a Cal.com meeting mirrored into Google Calendar only once", async () => {
    const start = new Date(Date.now() + 5 * 60_000).toISOString();
    const end = new Date(Date.now() + 65 * 60_000).toISOString();
    const result = await createService([], {
      calComConnected: true,
      events: [{
        id: "google-1",
        title: "Founder Sync",
        start,
        end,
        allDay: false,
        attendees: ["ada@example.com"],
      }],
      calComBookings: [{
        id: 10,
        uid: "cal-1",
        title: "Founder Sync",
        startTime: start,
        endTime: end,
        status: "accepted",
        attendees: [{ name: "Ada", email: "ada@example.com" }],
      }],
    }).morningBrief("owner@example.com");

    expect(result.text).toContain("Founder Sync");
    expect(result.text).not.toContain("Founder Sync [Cal.com]");
    expect(result.text).not.toContain("2 meetings today.");
  });

  it("uses identical reminder dedupe keys for mirrored Google and Cal.com records", async () => {
    const start = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const end = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const service = createService([], {
      calComConnected: true,
      events: [{
        id: "google-1",
        title: "Founder Sync",
        start,
        end,
        allDay: false,
        attendees: ["ada@example.com"],
      }],
      calComBookings: [{
        id: 10,
        uid: "cal-1",
        title: "Founder Sync",
        startTime: start,
        endTime: end,
        status: "accepted",
        attendees: [{ name: "Ada", email: "ada@example.com" }],
      }],
    });

    await service.syncMeetingReminders("owner@example.com", "calendar");
    await service.syncMeetingReminders("owner@example.com", "calcom");

    const keys = queueMocks.enqueueReminder.mock.calls.map(
      ([request]) => request.dedupeKey,
    );
    expect(keys).toHaveLength(6);
    expect(new Set(keys)).toHaveProperty("size", 3);
  });
});

describe("pickCorrelatedHint", () => {
  const meeting = {
    title: "15 min meeting between Aadarsh and jagdeep singh",
    people: ["Aadarsh", "jagdeep singh", "aadarsh@example.com"],
  };

  it("rejects an unrelated newsletter that vector search ranked first", () => {
    // Regression: the Medium Daily Digest "Build a Second Brain in 15
    // Minutes" email was cited as the source of a real Cal.com meeting.
    const newsletter = memory("m1", "Email from Medium Daily Digest <noreply@medium.com> (Build a Second Brain in 15 Minutes: Just Markdown, Git, and an AI Agent | Roan Brasil)", {});
    expect(pickCorrelatedHint([newsletter], meeting)).toBeUndefined();
  });

  it("accepts an email that mentions an attendee", () => {
    const related = memory("m2", "Email from Aadarsh confirming the 15 min intro call agenda", {});
    const newsletter = memory("m1", "Medium Daily Digest: Build a Second Brain in 15 Minutes", {});
    expect(pickCorrelatedHint([newsletter, related], meeting)?.id).toBe("m2");
  });

  it("matches on attendee email in metadata", () => {
    const related = memory("m3", "Booking confirmation", { from: "aadarsh@example.com" });
    expect(pickCorrelatedHint([related], meeting)?.id).toBe("m3");
  });

  it("cites nothing when no anchors can be derived", () => {
    const hit = memory("m4", "Weekly sync notes", {});
    expect(
      pickCorrelatedHint([hit], { title: "Meeting", people: [] }),
    ).toBeUndefined();
  });
});
