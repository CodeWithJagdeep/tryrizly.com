import type { ConnectorService } from "../connectors/connector.service";
import type { CalComService } from "../connectors/calcom.service";
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
          message: `Cal.com isn't connected yet, ${context.honorific} — add your API key in Connectors.`,
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
): HeyRizTool<CalComBookPayload> {
  return {
    name: "calcom_book",
    category: "calendar",
    description:
      "Create a new booking on Cal.com. Requires eventTypeId, a start time (ISO), attendee name and email. Always ask for approval first.",
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
    },
  };
}
