import type { ConnectorService } from "../connectors/connector.service";
import type { SlackService } from "../connectors/slack.service";
import type { HeyRizTool } from "./tool.types";

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
      "List the principal's connected Slack channels, or read recent messages from a named channel. Use when they ask what's happening on Slack or to check a specific channel.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getSlackSecret(userId);
      if (!secret) {
        return {
          tool: "slack_briefing",
          status: "needs_connection",
          message: `Slack isn't connected yet, ${context.honorific} — add a bot token in Connectors.`,
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
          const lines = channels.map((c) => `• #${c.name}`);
          return {
            tool: "slack_briefing",
            status: "ok",
            message: `${channels.length} Slack channel${channels.length === 1 ? "" : "s"} the bot can see, ${context.honorific}:\n\n${lines.join("\n")}`,
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

        const lines = messages.map((m) => `• ${m.text}`);
        return {
          tool: "slack_briefing",
          status: "ok",
          message: `${messages.length} recent message${messages.length === 1 ? "" : "s"} in #${match.name}, ${context.honorific}:\n\n${lines.join("\n")}`,
          data: { channel: match.name, count: messages.length },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code.startsWith("slack_api_error:invalid_auth") || code.startsWith("slack_api_error:token_revoked")) {
          return {
            tool: "slack_briefing",
            status: "needs_connection",
            message: `Slack rejected the saved bot token, ${context.honorific} — re-enter it in Connectors.`,
          };
        }
        throw error;
      }
    },
  };
}
