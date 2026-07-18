import type { ConnectorService } from "../connectors/connector.service";
import type { CalComService } from "../connectors/calcom.service";
import type { AvailabilityService } from "../availability/availability.service";
import type { HeyRizTool } from "./tool.types";

type CalComBriefingPayload = {
  status?: "upcoming" | "past" | "cancelled";
  take?: number;
};

type CalComBookPayload = {
  eventTypeId?: number;
  start?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  timeZone?: string;
  notes?: string;
  approved?: boolean;
  /** Only set after the principal explicitly chooses to double-book. */
  overrideConflict?: boolean;
};

export function createCalComBriefingTool(
  connectors: ConnectorService,
  calcom: CalComService,
): HeyRizTool<CalComBriefingPayload> {
  return {
    name: "calcom_briefing",
    category: "calendar",
    description:
      "List upcoming (or past/cancelled) Cal.com bookings for the principal. Use when they ask about their Cal.com schedule or who booked them.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getCalComSecret(userId);
      if (!secret) {
        return {
          tool: "calcom_briefing",
          status: "needs_connection",
          message: `Cal.com isn't connected yet, ${context.honorific} — connect it from the dashboard connectors page.`,
        };
      }

      const status = payload.status ?? "upcoming";
      const bookings = await calcom.listBookings(secret, { status, take: payload.take ?? 10 });

      if (bookings.length === 0) {
        return {
          tool: "calcom_briefing",
          status: "ok",
          message: `No ${status} Cal.com bookings found, ${context.honorific}.`,
          data: { bookings: [] },
        };
      }

      const lines = bookings.map((b) => {
        const when = new Date(b.startTime).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: context.timezone,
        });
        const who = b.attendees.map((a) => a.name).join(", ");
        return `• ${b.title} — ${when}${who ? ` with ${who}` : ""}${b.meetingUrl ? ` (${b.meetingUrl})` : ""}`;
      });

      return {
        tool: "calcom_briefing",
        status: "ok",
        message: `You have ${bookings.length} ${status} Cal.com booking${bookings.length === 1 ? "" : "s"}, ${context.honorific}:\n\n${lines.join("\n")}`,
        data: { bookings },
      };
    },
  };
}

export function createCalComBookTool(
  connectors: ConnectorService,
  calcom: CalComService,
  availability: AvailabilityService,
): HeyRizTool<CalComBookPayload> {
  return {
    name: "calcom_book",
    category: "calendar",
    description:
      "Create a new booking on Cal.com. Requires eventTypeId, a start time (ISO), attendee name and email. Always ask for approval first. The tool resolves the event duration and enforces a fresh Google Calendar + Cal.com conflict check immediately before booking. Only pass overrideConflict:true after the principal explicitly chooses to double-book.",
    approvalRequired: true,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getCalComSecret(userId);
      if (!secret) {
        return {
          tool: "calcom_book",
          status: "needs_connection",
          message: `Cal.com isn't connected, ${context.honorific}.`,
        };
      }

      const { eventTypeId, start, attendeeName, attendeeEmail, timeZone, notes } = payload;

      if (!payload.approved) {
        if (!eventTypeId || !start || !attendeeName || !attendeeEmail) {
          return {
            tool: "calcom_book",
            status: "ok",
            message: `To book on Cal.com I need: event type, date/time, attendee name and email. What's missing?`,
          };
        }
        return {
          tool: "calcom_book",
          status: "pending_approval",
          message: `Book a meeting for ${attendeeName} (${attendeeEmail}) starting ${new Date(start).toLocaleString("en-US", { timeZone: timeZone ?? context.timezone })}?`,
          data: { eventTypeId, start, attendeeName, attendeeEmail, timeZone, notes },
        };
      }

      if (!eventTypeId || !start || !attendeeName || !attendeeEmail) {
        return { tool: "calcom_book", status: "not_implemented", message: `Missing booking details, ${context.honorific}.` };
      }

      try {
        const eventTypes = await calcom.listEventTypes(secret);
        const eventType = eventTypes.find((candidate) => candidate.id === eventTypeId);
        if (!eventType || !Number.isFinite(eventType.length) || eventType.length <= 0) {
          return {
            tool: "calcom_book",
            status: "invalid_input",
            message: `I couldn't find a valid Cal.com event type with id ${eventTypeId}, ${context.honorific}. Refresh the event types and try again.`,
          };
        }

        const startMs = Date.parse(start);
        if (Number.isNaN(startMs)) {
          return {
            tool: "calcom_book",
            status: "invalid_input",
            message: `That Cal.com start time is invalid, ${context.honorific}.`,
          };
        }
        const end = new Date(startMs + eventType.length * 60_000).toISOString();

        if (!payload.overrideConflict) {
          const check = await availability.check({
            userId,
            start,
            end,
            timezone: timeZone ?? context.timezone,
          });
          if (!check.valid) {
            return {
              tool: "calcom_book",
              status: "invalid_input",
              message: check.reason ?? "That booking window is invalid.",
            };
          }
          if (!check.complete) {
            const failed = Object.entries(check.coverage)
              .filter(([, status]) => status === "error")
              .map(([source]) => source === "calcom" ? "Cal.com" : "Google Calendar")
              .join(" and ");
            return {
              tool: "calcom_book",
              status: "transient_error",
              message: `I couldn't verify ${failed} availability, ${context.honorific}, so I stopped before booking. Try again in a moment.`,
              data: { coverage: check.coverage },
            };
          }
          if (check.conflicts.length > 0) {
            const conflict = check.conflicts[0];
            const alternatives = check.alternatives.length > 0
              ? ` Free alternatives: ${check.alternatives
                  .map((slot) => formatDateTime(slot.start, timeZone ?? context.timezone))
                  .join(", ")}.`
              : "";
            return {
              tool: "calcom_book",
              status: "conflict",
              message: `That Cal.com booking clashes with "${conflict.title}" at ${formatDateTime(conflict.start, timeZone ?? context.timezone)}, ${context.honorific}.${alternatives} Choose an alternative, or explicitly tell me to double-book.`,
              data: {
                conflict,
                conflicts: check.conflicts,
                alternatives: check.alternatives,
                coverage: check.coverage,
                eventType: { id: eventType.id, title: eventType.title, length: eventType.length },
              },
            };
          }
        }

        const result = await calcom.createBooking(secret, {
          eventTypeId,
          start,
          name: attendeeName,
          email: attendeeEmail,
          timeZone: timeZone ?? context.timezone,
          notes,
        });

        return {
          tool: "calcom_book",
          status: "ok",
          message: `Booking created, ${context.honorific}${result.meetingUrl ? ` — join at ${result.meetingUrl}` : ""}.`,
          data: result,
        };
      } catch (error) {
        return {
          tool: "calcom_book",
          status: "transient_error",
          message: `Couldn't book that on Cal.com right now, ${context.honorific} — ${
            error instanceof Error ? error.message : "something went wrong"
          }. Try again in a moment.`,
        };
      }
    },
  };
}

function formatDateTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
