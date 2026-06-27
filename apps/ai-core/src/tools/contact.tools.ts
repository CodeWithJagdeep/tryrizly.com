import type { GoogleService } from "../google/google.service";
import type { HeyRizTool } from "./tool.types";

type LookupContactPayload = {
  name?: string;
};

export function createLookupContactTool(
  google: GoogleService,
): HeyRizTool<LookupContactPayload> {
  return {
    name: "lookup_contact",
    category: "gmail",
    description:
      "Find someone's email address by their name. Searches Google Contacts and recent Gmail history. Call this before drafting an email when you don't have the recipient's address.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const name = payload.name?.trim();
      if (!name) {
        return {
          tool: "lookup_contact",
          status: "not_implemented",
          message: `I need a name to search, ${context.honorific}.`,
        };
      }

      const res = await google.searchContacts(userId, name);
      if (!res.connected) {
        return {
          tool: "lookup_contact",
          status: "needs_connection",
          message: connectMessage(context.honorific),
          data: { connected: false },
        };
      }

      if (res.contacts.length === 0) {
        return {
          tool: "lookup_contact",
          status: "ok",
          message: `I couldn't find an email for ${name}, ${context.honorific} — do you have it handy?`,
          data: { found: false, name, contacts: [] },
        };
      }

      const top = res.contacts[0];
      const others = res.contacts.slice(1);
      const othersNote =
        others.length > 0
          ? ` (${others.length} other match${others.length > 1 ? "es" : ""}: ${others.map((c) => c.email).join(", ")})`
          : "";

      return {
        tool: "lookup_contact",
        status: "ok",
        message: `Found ${top.name} at ${top.email}${othersNote}, ${context.honorific}.`,
        data: { found: true, name, contacts: res.contacts },
      };
    },
  };
}

function connectMessage(honorific: string): string {
  return `Google isn't connected yet, ${honorific} — I can't look up contacts until then. Connect Gmail in the dashboard and I'll find the email for you.`;
}
