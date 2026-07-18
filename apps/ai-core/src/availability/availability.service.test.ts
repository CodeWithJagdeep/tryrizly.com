import { describe, expect, it, vi } from "vitest";
import { AvailabilityService, canonicalMeetingKey } from "./availability.service";

const googleEvent = {
  id: "google-1",
  title: "Founder Sync",
  start: "2026-07-20T09:00:00.000Z",
  end: "2026-07-20T10:00:00.000Z",
  allDay: false,
  attendees: ["ada@example.com"],
};

const calComBooking = {
  id: 10,
  uid: "cal-1",
  title: "Founder Sync",
  startTime: "2026-07-20T09:00:00.000Z",
  endTime: "2026-07-20T10:00:00.000Z",
  status: "accepted",
  attendees: [{ name: "Ada", email: "ada@example.com" }],
};

function createService(overrides?: {
  googleResult?: unknown;
  googleError?: Error;
  bookings?: unknown[];
}) {
  const google = {
    listEvents: overrides?.googleError
      ? vi.fn().mockRejectedValue(overrides.googleError)
      : vi.fn().mockResolvedValue(
          overrides?.googleResult ?? { connected: true, events: [googleEvent] },
        ),
  };
  const connectors = {
    getCalComSecret: vi.fn().mockResolvedValue({ kind: "apikey", apiKey: "secret" }),
  };
  const calcom = {
    listBookings: vi.fn().mockResolvedValue(overrides?.bookings ?? [calComBooking]),
  };
  return {
    service: new AvailabilityService(google as never, connectors as never, calcom as never),
    google,
    connectors,
    calcom,
  };
}

describe("AvailabilityService", () => {
  it("merges mirrored Google and Cal.com meetings before reporting a conflict", async () => {
    const { service } = createService();

    const result = await service.check({
      userId: "owner@example.com",
      start: "2026-07-20T09:15:00.000Z",
      end: "2026-07-20T10:15:00.000Z",
      timezone: "UTC",
    });

    expect(result.complete).toBe(true);
    expect(result.connectedSources).toEqual(["google", "calcom"]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].sources).toEqual([
      { provider: "google", id: "google-1" },
      { provider: "calcom", id: "cal-1" },
    ]);
  });

  it("calculates deterministic free alternatives on the local half-hour grid", async () => {
    const { service } = createService({ bookings: [] });

    const result = await service.check({
      userId: "owner@example.com",
      start: "2026-07-20T09:00:00.000Z",
      end: "2026-07-20T10:00:00.000Z",
      timezone: "UTC",
    });

    expect(result.alternatives).toEqual([
      { start: "2026-07-20T10:00:00.000Z", end: "2026-07-20T11:00:00.000Z" },
      { start: "2026-07-20T10:30:00.000Z", end: "2026-07-20T11:30:00.000Z" },
      { start: "2026-07-20T11:00:00.000Z", end: "2026-07-20T12:00:00.000Z" },
    ]);
  });

  it("excludes the event being moved during a reschedule check", async () => {
    const { service } = createService({ bookings: [] });

    const result = await service.check({
      userId: "owner@example.com",
      start: "2026-07-20T09:30:00.000Z",
      end: "2026-07-20T10:30:00.000Z",
      timezone: "UTC",
      exclude: { googleEventId: "google-1" },
    });

    expect(result.conflicts).toEqual([]);
  });

  it("marks availability incomplete when a connected provider check errors", async () => {
    const { service } = createService({ googleError: new Error("provider timeout"), bookings: [] });

    const result = await service.check({
      userId: "owner@example.com",
      start: "2026-07-20T09:00:00.000Z",
      end: "2026-07-20T10:00:00.000Z",
      timezone: "UTC",
    });

    expect(result.complete).toBe(false);
    expect(result.coverage.google).toBe("error");
  });

  it("fails closed when a configured Cal.com account cannot produce credentials", async () => {
    const service = new AvailabilityService(
      {
        listEvents: vi.fn().mockResolvedValue({ connected: true, events: [] }),
      } as never,
      {
        getCalComSecret: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue([{ provider: "calcom", status: "connected" }]),
      } as never,
      {} as never,
    );

    const result = await service.check({
      userId: "owner@example.com",
      start: "2026-07-20T09:00:00.000Z",
      end: "2026-07-20T10:00:00.000Z",
      timezone: "UTC",
    });

    expect(result.complete).toBe(false);
    expect(result.coverage.calcom).toBe("error");
  });

  it("creates the same canonical identity for mirrored provider records", () => {
    expect(canonicalMeetingKey({
      title: googleEvent.title,
      start: googleEvent.start,
      end: googleEvent.end,
    })).toBe(canonicalMeetingKey({
      title: calComBooking.title,
      start: calComBooking.startTime,
      end: calComBooking.endTime,
    }));
  });
});
