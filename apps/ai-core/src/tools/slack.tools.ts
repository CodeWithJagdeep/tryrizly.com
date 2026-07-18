import type { ConnectorService } from "../connectors/connector.service";
import type { SlackService } from "../connectors/slack.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type SlackBriefingPayload = {
  /** Channel name to read recent messages from, e.g. "general". Omit to list available channels. */
  channel?: string;
  /** How many recent messages to pull from the channel (default 20, max 50). */
  limit?: number;
};

export function createSlackBriefingTool(
  connectors: ConnectorService,
  slack: SlackService,
): HeyRizTool<SlackBriefingPayload> {
  return {
    name: "slack_briefing",
    category: "business",
    description:
      "List Slack channels the connected bot has joined, or read recent messages from a named channel with authors, times, and source links. Use when they ask what's happening on Slack or to check a specific channel.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getSlackSecret(userId);
      if (!secret) {
        return {
          tool: "slack_briefing",
          status: "needs_connection",
          message: `Slack isn't connected yet, ${context.honorific}. Add the bot token here: ${connectorSetupUrl("slack")}`,
        };
      }

      try {
        const channels = await slack.listChannels(secret);

        if (!payload.channel) {
          if (channels.length === 0) {
            return {
              tool: "slack_briefing",
              status: "ok",
              message: `The Slack bot isn't in any channels yet, ${context.honorific} — invite it to one first.`,
              data: { channels: [] },
            };
          }
          const lines = channels.slice(0, 30).map((c) => `• #${c.name}`);
          return {
            tool: "slack_briefing",
            status: "ok",
            message: `Slack · connected channels · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n")}\n\nAsk: "What happened in #channel?"`,
            data: { channels },
          };
        }

        const wanted = payload.channel.replace(/^#/, "").toLowerCase();
        const match = channels.find((c) => c.name.toLowerCase() === wanted);
        if (!match) {
          return {
            tool: "slack_briefing",
            status: "ok",
            message: `I don't see a Slack channel called #${wanted}, ${context.honorific} — the bot may not be invited to it.`,
            data: { channel: wanted, messages: [] },
          };
        }

        const limit = Math.min(Math.max(payload.limit ?? 20, 1), 50);
        const messages = await slack.getChannelHistory(secret, match.id, limit);

        if (messages.length === 0) {
          return {
            tool: "slack_briefing",
            status: "ok",
            message: `No recent messages in #${match.name}, ${context.honorific}.`,
            data: { channel: match.name, messages: [] },
          };
        }

        const lines = messages.slice(0, 8).map((message) => {
          const author = message.userName ?? "Slack member";
          const text = truncate(message.text.replace(/\s+/g, " ").trim(), 240);
          return `• ${author} · ${formatSlackTime(message.ts, context.timezone)}\n  ${text}${message.permalink ? `\n  ${message.permalink}` : ""}`;
        });
        return {
          tool: "slack_briefing",
          status: "ok",
          message: `Slack · #${match.name} · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n\n")}${messages.length > 8 ? `\n\n${messages.length - 8} more recent messages were not shown.` : ""}`,
          data: { channel: match.name, count: messages.length },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code.startsWith("slack_api_error:invalid_auth") || code.startsWith("slack_api_error:token_revoked")) {
          return {
            tool: "slack_briefing",
            status: "needs_connection",
            message: `Slack rejected the saved bot token, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("slack")}`,
          };
        }
        throw error;
      }
    },
  };
}

function formatSlackTime(ts: string, timezone: string): string {
  const seconds = Number(ts.split(".")[0]);
  if (!Number.isFinite(seconds)) return "unknown time";
  return new Date(seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
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

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}
