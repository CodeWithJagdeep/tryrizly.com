import { describe, expect, it } from "vitest";
import { isExpiredNotification } from "./notification.worker.service";

describe("isExpiredNotification", () => {
  const now = Date.parse("2026-07-29T09:00:00Z");

  it("drops a reminder whose expiry has passed", () => {
    // Regression: a queued "starts in 5 minutes" nudge delivered a day late
    // (worker backlog/restart) was still sent for an already-finished meeting.
    expect(
      isExpiredNotification({ expiresAt: "2026-07-28T09:02:00Z" }, now),
    ).toBe(true);
  });

  it("delivers a reminder that is still within its window", () => {
    expect(
      isExpiredNotification({ expiresAt: "2026-07-29T09:30:00Z" }, now),
    ).toBe(false);
  });

  it("delivers when no expiry is set (non-time-sensitive notifications)", () => {
    expect(isExpiredNotification(undefined, now)).toBe(false);
    expect(isExpiredNotification({}, now)).toBe(false);
    expect(isExpiredNotification({ kind: "meeting_t5" }, now)).toBe(false);
  });

  it("delivers when the expiry is malformed rather than guessing", () => {
    expect(isExpiredNotification({ expiresAt: "not-a-date" }, now)).toBe(false);
    expect(isExpiredNotification({ expiresAt: 12345 }, now)).toBe(false);
  });
});
