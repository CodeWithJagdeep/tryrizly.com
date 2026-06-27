import { Injectable } from "@nestjs/common";

export type SlackSecret = { botToken: string };

export type SlackMessage = {
  ts: string;
  text: string;
  user?: string;
  channel?: string;
};

@Injectable()
export class SlackService {
  async listChannels(secret: SlackSecret): Promise<{ id: string; name: string }[]> {
    const res = await this.call(secret, "conversations.list", { types: "public_channel,private_channel", limit: "50" });
    const channels = (res.channels ?? []) as { id: string; name: string }[];
    return channels;
  }

  async searchMessages(secret: SlackSecret, query: string): Promise<SlackMessage[]> {
    const res = await this.call(secret, "search.messages", { query, count: "20" });
    const msgResult = res.messages as { matches?: unknown[] } | undefined;
    const matches = (msgResult?.matches ?? []) as { ts: string; text: string; user?: string; channel?: { name?: string } }[];
    return matches.map((m) => ({
      ts: m.ts,
      text: m.text,
      user: m.user,
      channel: m.channel?.name,
    }));
  }

  async getChannelHistory(secret: SlackSecret, channelId: string, limit = 20): Promise<SlackMessage[]> {
    const res = await this.call(secret, "conversations.history", {
      channel: channelId,
      limit: String(limit),
    });
    return ((res.messages ?? []) as { ts: string; text: string; user?: string }[]).map((m) => ({
      ts: m.ts,
      text: m.text,
      user: m.user,
      channel: channelId,
    }));
  }

  private async call(secret: SlackSecret, method: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const url = new URL(`https://slack.com/api/${method}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${secret.botToken}` },
    });

    if (!res.ok) throw new Error(`slack_api_${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!data.ok) throw new Error(`slack_api_error:${String(data.error ?? "unknown")}`);
    return data;
  }
}
