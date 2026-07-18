import { Injectable } from "@nestjs/common";

export type DiscordSecret = {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  guildId?: string;
};

export type DiscordMessage = {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  channelId: string;
  channelName?: string;
  url?: string;
};

@Injectable()
export class DiscordService {
  /** Posts a message via an incoming webhook — the only write Discord permits without a full bot install. */
  async postMessage(secret: DiscordSecret, content: string): Promise<void> {
    if (!secret.webhookUrl) throw new Error("discord_missing_webhook");
    const webhookUrl = requireDiscordWebhookUrl(secret.webhookUrl);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 404) {
        throw new Error("discord_invalid_webhook");
      }
      throw new Error(`discord_api_${res.status}`);
    }
  }

  /** Read access requires a Discord bot token and a channel the bot can view. */
  async getChannelMessages(secret: DiscordSecret, limit = 25): Promise<DiscordMessage[]> {
    if (!secret.botToken || !secret.channelId) throw new Error("discord_read_not_configured");
    const channelId = requireSnowflake(secret.channelId);
    const headers = { Authorization: `Bot ${secret.botToken}` };
    const [messagesResponse, channelResponse] = await Promise.all([
      fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${Math.min(Math.max(limit, 1), 100)}`, {
        headers,
      }),
      fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers }).catch(() => undefined),
    ]);
    if (messagesResponse.status === 401 || messagesResponse.status === 403) {
      throw new Error("discord_read_forbidden");
    }
    if (!messagesResponse.ok) throw new Error(`discord_api_${messagesResponse.status}`);
    const channel = channelResponse?.ok
      ? ((await channelResponse.json()) as { name?: string; guild_id?: string })
      : undefined;
    const guildId = secret.guildId ?? channel?.guild_id;
    const messages = (await messagesResponse.json()) as Array<{
      id: string;
      content?: string;
      timestamp: string;
      author?: { global_name?: string; username?: string };
    }>;
    return messages.map((message) => ({
      id: message.id,
      content: message.content ?? "",
      author: message.author?.global_name ?? message.author?.username ?? "Discord member",
      timestamp: message.timestamp,
      channelId,
      channelName: channel?.name,
      url: guildId ? `https://discord.com/channels/${guildId}/${channelId}/${message.id}` : undefined,
    }));
  }
}

export function requireDiscordWebhookUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("discord_invalid_webhook");
  }
  const allowedHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
  if (url.protocol !== "https:" || !allowedHost || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname)) {
    throw new Error("discord_invalid_webhook");
  }
  return url.toString();
}

function requireSnowflake(value: string): string {
  if (!/^\d{15,22}$/.test(value)) throw new Error("discord_invalid_channel_id");
  return value;
}
