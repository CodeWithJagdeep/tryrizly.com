import type { GoogleService } from "../google/google.service";
import type { CalendarEvent } from "../google/google.types";
import { localDateTimeToUtc, zonedTimeToUtc } from "../lib/timezone";
import type { HeyRizTool } from "./tool.types";

type BriefingPayload = {
  /** "today" (default) or "next" for the upcoming 24-hour window. */
  range?: "today" | "next";
  /** ISO date strings for an arbitrary date window. */
  startDate?: string;
  endDate?: string;
};

export function createCalendarBriefingTool(
  google: GoogleService,
): HeyRizTool<BriefingPayload> {
  return {
    name: "calendar_briefing",
    category: "calendar",
    description:
      "Read the principal's real calendar for today, the next 24h, or a specific start/end window and summarize the schedule.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const now = new Date();
      const start = payload.startDate
        ? new Date(payload.startDate)
        : payload.range === "next"
          ? now
          : startOfDay(now, context.timezone);
      const end = payload.endDate
        ? new Date(payload.endDate)
        : payload.range === "next"
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : endOfDay(start, context.timezone);
      const windowLabel = calendarWindowLabel(start, end, context.timezone, payload.range);

      const res = await google.listEvents(userId, {
        timeMin: start,
        timeMax: end,
        maxResults: payload.startDate ? 200 : 25,
      });

      if (!res.connected) {
        return notConnected("calendar_briefing", context.honorific);
      }

      const timed = res.events.filter((e) => !e.allDay && e.start);
      const next = timed.find((e) => Date.parse(e.start as string) > Date.now());

      return {
        tool: "calendar_briefing",
        status: "ok",
        message: summarizeSchedule(
          res.events,
          context.honorific,
          context.timezone,
          windowLabel,
          next,
        ),
        data: {
          count: res.events.length,
          events: res.events,
          next: next
            ? {
                title: next.title,
                start: next.start,
                minutesUntil: minutesUntil(next.start as string),
                joinLink: next.hangoutLink,
              }
            : null,
        },
      };
    },
  };
}

type CreateEventPayload = {
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
  approved?: boolean;
  /** Set when the principal already chose to double-book after seeing a
   * conflict — skips the conflict re-check instead of blocking again. */
  overrideConflict?: boolean;
};

export function createCreateCalendarEventTool(
  google: GoogleService,
): HeyRizTool<CreateEventPayload> {
  return {
    name: "create_calendar_event",
    category: "calendar",
    description:
      'Create a calendar event. Requires explicit approval. Needs summary, start (ISO), end (ISO), optional attendees. If a prior call returned status "conflict" and the principal explicitly said to book it anyway / double-book (not just "proceed", which is ambiguous — confirm first), pass overrideConflict:true so this call actually creates it instead of re-blocking on the same conflict.',
    approvalRequired: true,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (payload.approved !== true) {
        return {
          tool: "create_calendar_event",
          status: "pending_approval",
          message: `Creating a calendar event needs your explicit approval, ${context.honorific}.`,
        };
      }
      if (!payload.summary || !payload.start || !payload.end) {
        return {
          tool: "create_calendar_event",
          status: "not_implemented",
          message: `I need a title, start and end time to create the event, ${context.honorific}.`,
        };
      }

      if (!payload.overrideConflict) {
        const dayEvents = await google.listEvents(userId, {
          timeMin: startOfDay(new Date(payload.start), context.timezone),
          timeMax: endOfDay(new Date(payload.start), context.timezone),
          maxResults: 25,
        });
        if (dayEvents.connected) {
          const conflict = findConflict(dayEvents.events, payload.start, payload.end);
          if (conflict) {
            return {
              tool: "create_calendar_event",
              status: "conflict",
              message: `Hold on, ${context.honorific} — that clashes with "${conflict.title}" at ${fmtTime(conflict.start, context.timezone)}. Want a different time, or should I book it anyway?`,
              data: { conflict },
            };
          }
        }
      }

      const res = await google.createEvent(userId, {
        summary: payload.summary,
        start: payload.start,
        end: payload.end,
        description: payload.description,
        location: payload.location,
        attendees: payload.attendees,
        // Fall back to the principal's saved timezone — never UTC — so a naive
        // local time ("10am") lands in their zone, not off by their offset.
        timeZone: payload.timeZone ?? context.timezone,
      });

      if (!res.connected) {
        return notConnected("create_calendar_event", context.honorific);
      }

      // State the real booked time deterministically — never let the model
      // reconstruct/paraphrase it from raw ISO data in "say", which is how a
      // wrong time (e.g. off by the timezone offset) can slip into the reply.
      return {
        tool: "create_calendar_event",
        status: "ok",
        message: `Done, ${context.honorific} — "${res.event.title}" is on your calendar for ${fmtDateTime(res.event.start, context.timezone)}.`,
        data: { event: res.event },
      };
    },
  };
}

type CheckConflictPayload = {
  start?: string;
  end?: string;
};

export function createCheckCalendarConflictTool(
  google: GoogleService,
): HeyRizTool<CheckConflictPayload> {
  return {
    name: "check_calendar_conflict",
    category: "calendar",
    description:
      "Check whether a proposed start/end window (ISO) overlaps an existing calendar event, before proposing to create or move one.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (!payload.start || !payload.end) {
        return {
          tool: "check_calendar_conflict",
          status: "not_implemented",
          message: `I need a start and end time to check for conflicts, ${context.honorific}.`,
        };
      }

      const res = await google.listEvents(userId, {
        timeMin: startOfDay(new Date(payload.start), context.timezone),
        timeMax: endOfDay(new Date(payload.start), context.timezone),
        maxResults: 25,
      });
      if (!res.connected) {
        return notConnected("check_calendar_conflict", context.honorific);
      }

      const conflict = findConflict(res.events, payload.start, payload.end);
      if (!conflict) {
        return {
          tool: "check_calendar_conflict",
          status: "ok",
          message: `That window's free, ${context.honorific}.`,
          data: { conflict: null },
        };
      }

      return {
        tool: "check_calendar_conflict",
        status: "conflict",
        message: `That clashes with "${conflict.title}"${conflict.attendees.length ? ` (with ${conflict.attendees.join(", ")})` : ""} at ${fmtTime(conflict.start, context.timezone)}, ${context.honorific}.`,
        data: { conflict },
      };
    },
  };
}

type RescheduleEventPayload = {
  eventId?: string;
  newStart?: string;
  newEnd?: string;
  notifyAttendee?: boolean;
  timeZone?: string;
  approved?: boolean;
};

export function createRescheduleCalendarEventTool(
  google: GoogleService,
): HeyRizTool<RescheduleEventPayload> {
  return {
    name: "reschedule_calendar_event",
    category: "calendar",
    description:
      "Move an existing calendar event to a new time and notify the attendee. Requires explicit approval. Needs eventId (from calendar_briefing or check_calendar_conflict — never invent one), newStart, newEnd (ISO).",
    approvalRequired: true,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (payload.approved !== true) {
        return {
          tool: "reschedule_calendar_event",
          status: "pending_approval",
          message: `Moving that event needs your explicit approval, ${context.honorific}.`,
        };
      }
      if (!payload.eventId || !payload.newStart || !payload.newEnd) {
        return {
          tool: "reschedule_calendar_event",
          status: "not_implemented",
          message: `I need to know which event and the new start/end time before I can move it, ${context.honorific}.`,
        };
      }

      const res = await google.updateEvent(userId, payload.eventId, {
        start: payload.newStart,
        end: payload.newEnd,
        notifyAttendee: payload.notifyAttendee,
        // Same as create: a naive new time is the principal's local time, not UTC.
        timeZone: payload.timeZone ?? context.timezone,
      });

      if (!res.connected) {
        return notConnected("reschedule_calendar_event", context.honorific);
      }

      const notified = payload.notifyAttendee !== false;
      return {
        tool: "reschedule_calendar_event",
        status: "ok",
        message: `Done, ${context.honorific} — "${res.event.title}" is now at ${fmtDateTime(res.event.start, context.timezone)}${notified ? " and they've been notified" : ""}.`,
        data: { event: res.event },
      };
    },
  };
}

function findConflict(
  events: CalendarEvent[],
  start: string,
  end: string,
): CalendarEvent | undefined {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return events.find((e) => {
    if (e.allDay || !e.start || !e.end) return false;
    const eStart = Date.parse(e.start);
    const eEnd = Date.parse(e.end);
    return startMs < eEnd && endMs > eStart;
  });
}

function summarizeSchedule(
  events: CalendarEvent[],
  honorific: string,
  timezone: string,
  windowLabel: string,
  next?: CalendarEvent,
): string {
  if (events.length === 0) {
    return `Your calendar is clear ${windowLabel}, ${honorific}.`;
  }

  const lines = events.map((e) => formatScheduleLine(e, timezone)).join("; ");

  const nextLine = next
    ? ` Next up: ${next.title} at ${fmtTime(next.start, timezone)}.`
    : "";

  const count = events.length;
  return `${count} item${count === 1 ? "" : "s"} ${windowLabel} — ${lines}.${nextLine}`;
}

/** Already-finished events are marked "(completed)" instead of listed as if still open. */
function formatScheduleLine(e: CalendarEvent, timezone: string): string {
  if (e.allDay) return `all-day ${e.title}`;
  const endMs = Date.parse(e.end ?? e.start ?? "");
  if (!Number.isNaN(endMs) && endMs < Date.now()) {
    return `${e.title} (completed)`;
  }
  return `${fmtTime(e.start, timezone)} ${e.title}`;
}

function notConnected(tool: string, honorific: string) {
  return {
    tool,
    status: "needs_connection" as const,
    message: `Google not connected. NEXT STEP: call the connect_google tool immediately to send ${honorific} a direct sign-in link. Do not tell them to use the dashboard.`,
    data: { connected: false },
  };
}

function startOfDay(d: Date, timezone: string): Date {
  return zonedTimeToUtc(d, timezone, 0, 0);
}

function endOfDay(d: Date, timezone: string): Date {
  return new Date(zonedTimeToUtc(d, timezone, 23, 59).getTime() + 59_999);
}

function fmtTime(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date + time together — used where the model must not be left to infer or
 * restate the date itself (e.g. the final confirmation of a created event). */
function fmtDateTime(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${datePart} at ${fmtTime(iso, timezone)}`;
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
}

function calendarWindowLabel(
  start: Date,
  end: Date,
  timezone: string,
  range?: BriefingPayload["range"],
): string {
  if (range === "next") return "in the next 24 hours";

  const startDay = dayKey(start, timezone);
  const endDay = dayKey(end, timezone);
  const today = dayKey(new Date(), timezone);
  const tomorrow = dayKey(addLocalDays(new Date(), timezone, 1), timezone);

  if (startDay === today && endDay === today) return "today";
  if (startDay === tomorrow && endDay === tomorrow) return "tomorrow";
  if (startDay === endDay) {
    return `on ${start.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    })}`;
  }

  const startLabel = start.toLocaleDateString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
  return `from ${startLabel} to ${endLabel}`;
}

function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addLocalDays(date: Date, timezone: string, days: number): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return localDateTimeToUtc(get("year"), get("month"), get("day") + days, 12, 0, timezone);
}
