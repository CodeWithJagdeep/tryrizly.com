import { env } from "@heyriz/shared/env";
import type { HeyRizTool } from "./tool.types";

type ConnectGooglePayload = Record<string, never>;

/**
 * Gmail and Calendar are now independent OAuth connections, each with its own
 * connect button on the dashboard — so this tool just points the principal
 * there instead of minting a single combined auth link.
 */
export function createConnectGoogleTool(): HeyRizTool<ConnectGooglePayload> {
  return {
    name: "connect_google",
    category: "memory",
    description:
      "Tell the principal where to connect Gmail and/or Calendar. Call this whenever a Gmail or Calendar tool returns needs_connection.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ context }) {
      return {
        tool: "connect_google",
        status: "ok",
        message: `Gmail and Calendar aren't connected yet, ${context.honorific} — head to the dashboard (${env.WEB_APP_URL}/dashboard/connectors) and connect each one there. I'll be able to read them as soon as you do.`,
      };
    },
  };
}
