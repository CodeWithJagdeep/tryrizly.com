import type { ConnectorService } from "../connectors/connector.service";
import type { DiscordService } from "../connectors/discord.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

const DISCORD_CONTENT_LIMIT = 2000;

type DiscordSendPayload = {
  content?: string;
  approved?: boolean;
};

export function createDiscordSendTool(
  connectors: ConnectorService,
  discord: DiscordService,
): HeyRizTool<DiscordSendPayload> {
  return {
    name: "discord_send",
    category: "business",
    description:
      "Post a message to the principal's connected Discord channel via webhook. Requires explicit approval. Needs content.",
    approvalRequired: true,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getDiscordSecret(userId);
      if (!secret?.webhookUrl) {
        return {
          tool: "discord_send",
          status: "needs_connection",
          message: `Discord posting needs a channel webhook, ${context.honorific}. Add one here: ${connectorSetupUrl("discord")}`,
        };
      }

      if (payload.approved !== true) {
        return {
          tool: "discord_send",
          status: "pending_approval",
          message: `Posting to Discord needs your explicit approval, ${context.honorific}.`,
        };
      }

      if (!payload.content?.trim()) {
        return {
          tool: "discord_send",
          status: "not_implemented",
          message: `I need message content before I can post to Discord, ${context.honorific}.`,
        };
      }

      const content = payload.content.slice(0, DISCORD_CONTENT_LIMIT);

      try {
        await discord.postMessage(secret, content);
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "discord_invalid_webhook" || code === "discord_missing_webhook") {
          return {
            tool: "discord_send",
            status: "needs_connection",
            message: `Discord rejected the saved webhook, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("discord")}`,
          };
        }
        throw error;
      }

      return {
        tool: "discord_send",
        status: "ok",
        message: `Posted to Discord, ${context.honorific}.`,
        data: { content },
      };
    },
  };
}
