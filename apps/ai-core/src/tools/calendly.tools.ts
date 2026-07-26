import type { ConnectorService } from "../connectors/connector.service";
import type { CalendlyService } from "../connectors/calendly.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type CalendlyEventsPayload = {
  /** "active" (default) for upcoming/booked events, "canceled" for cancellations. */
  status?: "active" | "canceled";
  /** Max events to return (default 10, max 25). */
  maxResults?: number;
};

export function createCalendlyEventsTool(
  connectors: ConnectorService,
  calendly: CalendlyService,
): HeyRizTool<CalendlyEventsPayload> {
  return {
    name: "calendly_events",
    category: "business",
    description:
      "List the principal's Calendly scheduled events — upcoming bookings by default, or cancellations when status is 'canceled'. Use when they ask about new bookings, meetings on Calendly, or who scheduled time with them.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getCalendlySecret(userId);
      if (!secret) {
        return {
          tool: "calendly_events",
          status: "needs_connection",
          message: `Calendly isn't connected yet, ${context.honorific}. Connect it here: ${connectorSetupUrl("calendly")}`,
        };
      }

      try {
        const events = await calendly.listScheduledEvents(secret, {
          status: payload.status,
          maxResults: payload.maxResults,
        });

        if (events.length === 0) {
          return {
            tool: "calendly_events",
            status: "ok",
            message: `No ${payload.status === "canceled" ? "canceled" : "upcoming"} Calendly events, ${context.honorific}.`,
            data: { events: [] },
          };
        }

        const lines = events.map(
          (event) =>
            `• ${event.name} — ${formatEventTime(event.startTime, event.endTime, context.timezone)}${event.location ? ` · ${event.location}` : ""}`,
        );

        return {
          tool: "calendly_events",
          status: "ok",
          message: `Calendly · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n")}`,
          data: { events },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "calendly_invalid_credentials") {
          return {
            tool: "calendly_events",
            status: "needs_connection",
            message: `Calendly rejected the saved connection, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("calendly")}`,
          };
        }
        throw error;
      }
    },
  };
}

function formatEventTime(start: string, end: string, timezone: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "unknown time";
  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: timezone };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: timezone };
  return `${startDate.toLocaleDateString("en-US", dateOpts)}, ${startDate.toLocaleTimeString("en-US", timeOpts)}–${endDate.toLocaleTimeString("en-US", timeOpts)}`;
}

function formatCheckedAt(timezone: string): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}
