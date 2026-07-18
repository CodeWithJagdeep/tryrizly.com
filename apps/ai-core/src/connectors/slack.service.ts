import { Injectable } from "@nestjs/common";

export type SlackSecret = { botToken: string };

export type SlackMessage = {
  ts: string;
  text: string;
  user?: string;
  userName?: string;
  channel?: string;
  channelId?: string;
  permalink?: string;
};

export type SlackChannel = { id: string; name: string };

@Injectable()
export class SlackService {
  async listChannels(secret: SlackSecret): Promise<SlackChannel[]> {
    const res = await this.call(secret, "conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "100",
    });
    const channels = (res.channels ?? []) as Array<{
      id: string;
      name: string;
      is_member?: boolean;
      is_private?: boolean;
    }>;
    return channels
      .filter((channel) => channel.is_member === true || channel.is_private === true)
      .map(({ id, name }) => ({ id, name }));
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
    const messages = await this.readChannelHistory(secret, channelId, limit);
    return this.enrichMessages(secret, messages);
  }

  /**
   * Reads across channels the bot has actually joined. Histories are fetched
   * first and only the final small result set is enriched, avoiding a burst of
   * users.info/permalink calls for messages that will never reach the agent.
   */
  async getRecentMessages(
    secret: SlackSecret,
    input: { query?: string; channel?: string; oldest?: Date; limit?: number } = {},
  ): Promise<SlackMessage[]> {
    const channels = await this.listChannels(secret);
    const wanted = input.channel?.replace(/^#/, "").toLowerCase();
    const selected = wanted
      ? channels.filter((channel) => channel.name.toLowerCase() === wanted)
      : channels.slice(0, 12);
    const batches = await Promise.all(
      selected.map(async (channel) =>
        (await this.readChannelHistory(secret, channel.id, 50)).map((message) => ({
          ...message,
          channel: channel.name,
          channelId: channel.id,
        })),
      ),
    );
    const oldestSeconds = input.oldest ? input.oldest.getTime() / 1000 : 0;
    const query = input.query?.trim();
    const matched = batches
      .flat()
      .filter((message) => Number(message.ts.split(".")[0]) >= oldestSeconds)
      .filter((message) => !query || matchesQuery(message.text, query))
      .sort((a, b) => Number(b.ts) - Number(a.ts))
      .slice(0, Math.min(Math.max(input.limit ?? 12, 1), 30));
    return this.enrichMessages(secret, matched);
  }

  private async readChannelHistory(
    secret: SlackSecret,
    channelId: string,
    limit: number,
  ): Promise<SlackMessage[]> {
    const res = await this.call(secret, "conversations.history", {
      channel: channelId,
      limit: String(Math.min(Math.max(limit, 1), 100)),
    });
    return ((res.messages ?? []) as { ts: string; text: string; user?: string }[]).map((message) => ({
      ts: message.ts,
      text: message.text,
      user: message.user,
      channel: channelId,
      channelId,
    }));
  }

  private async enrichMessages(secret: SlackSecret, messages: SlackMessage[]): Promise<SlackMessage[]> {
    const userIds = [
      ...new Set(
        messages.flatMap((message) => [
          ...(message.user ? [message.user] : []),
          ...[...message.text.matchAll(/<@([A-Z0-9]+)>/g)].map((match) => match[1]),
        ]),
      ),
    ];
    const users = new Map<string, string>();

    await Promise.all(
      userIds.slice(0, 30).map(async (userId) => {
        const response = await this.call(secret, "users.info", { user: userId }).catch(() => undefined);
        const user = response?.user as
          | { name?: string; real_name?: string; profile?: { display_name?: string; real_name?: string } }
          | undefined;
        const name = user?.profile?.display_name || user?.profile?.real_name || user?.real_name || user?.name;
        if (name) users.set(userId, name);
      }),
    );

    return Promise.all(
      messages.map(async (message, index) => {
        const permalink =
          index < 12 && message.channelId
            ? await this.call(secret, "chat.getPermalink", {
                channel: message.channelId,
                message_ts: message.ts,
              })
                .then((response) => (typeof response.permalink === "string" ? response.permalink : undefined))
                .catch(() => undefined)
            : undefined;
        const text = message.text.replace(/<@([A-Z0-9]+)>/g, (_match, userId: string) =>
          users.has(userId) ? `@${users.get(userId)}` : "@member",
        );
        return {
          ...message,
          text,
          userName: message.user ? users.get(message.user) : undefined,
          permalink,
        };
      }),
    );
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

function matchesQuery(text: string, query: string): boolean {
  const terms = query.toLowerCase().match(/[a-z0-9_-]{2,}/g) ?? [];
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  return matches >= Math.max(1, Math.ceil(terms.length * 0.6));
}
