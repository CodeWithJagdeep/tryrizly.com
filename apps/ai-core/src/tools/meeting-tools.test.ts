import { describe, expect, it, vi } from "vitest";
import { createRescheduleCalendarEventTool } from "./calendar.tools";
import { createCalComBookTool } from "./calcom.tools";

const context = {
  honorific: "sir",
  timezone: "UTC",
};

const conflictCheck = {
  valid: true,
  complete: true,
  connectedSources: ["google", "calcom"],
  coverage: { google: "connected", calcom: "connected" },
  conflicts: [{
    title: "Board Review",
    start: "2026-07-20T09:00:00.000Z",
    end: "2026-07-20T10:00:00.000Z",
    attendees: [],
    sources: [{ provider: "google", id: "busy-1" }],
  }],
  alternatives: [{
    start: "2026-07-20T10:00:00.000Z",
    end: "2026-07-20T11:00:00.000Z",
  }],
};

describe("meeting write tools", () => {
  it("enforces a fresh conflict check inside reschedule before updating Google", async () => {
    const updateEvent = vi.fn();
    const check = vi.fn().mockResolvedValue(conflictCheck);
    const tool = createRescheduleCalendarEventTool(
      { updateEvent } as never,
      { check } as never,
    );

    const result = await tool.execute({
      userId: "owner@example.com",
      context: context as never,
      payload: {
        eventId: "moving-1",
        newStart: "2026-07-20T09:30:00.000Z",
        newEnd: "2026-07-20T10:30:00.000Z",
        approved: true,
      },
    });

    expect(result.status).toBe("conflict");
    expect(result.message).toContain("Free alternatives: Mon, Jul 20 at 10:00");
    expect(check).toHaveBeenCalledWith(expect.objectContaining({
      exclude: { googleEventId: "moving-1" },
    }));
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("derives the Cal.com duration and blocks the provider write on conflict", async () => {
    const createBooking = vi.fn();
    const check = vi.fn().mockResolvedValue(conflictCheck);
    const tool = createCalComBookTool(
      { getCalComSecret: vi.fn().mockResolvedValue({ kind: "apikey", apiKey: "secret" }) } as never,
      {
        listEventTypes: vi.fn().mockResolvedValue([
          { id: 42, slug: "intro", title: "Intro", length: 30 },
        ]),
        createBooking,
      } as never,
      { check } as never,
    );

    const result = await tool.execute({
      userId: "owner@example.com",
      context: context as never,
      payload: {
        eventTypeId: 42,
        start: "2026-07-20T09:00:00.000Z",
        attendeeName: "Ada",
        attendeeEmail: "ada@example.com",
        approved: true,
      },
    });

    expect(result.status).toBe("conflict");
    expect(check).toHaveBeenCalledWith(expect.objectContaining({
      start: "2026-07-20T09:00:00.000Z",
      end: "2026-07-20T09:30:00.000Z",
    }));
    expect(createBooking).not.toHaveBeenCalled();
  });
});
