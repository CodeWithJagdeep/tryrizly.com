import { randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { getDb } from "@heyriz/shared/db/mongo";

export type DiscordChannel = {
  guildId: string;
  channelId: string;
  name: string;
  type: number;
};

export type DiscordChannelResolution =
  | { channelId: string; name: string }
  | { ambiguous: true; candidates: Array<{ channelId: string; name: string }> }
  | null;

/** Lowercase, strip a leading "#", collapse anything outside [a-z0-9-] — the only normalization resolveChannel ever applies. */
function normalizeChannelQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SNOWFLAKE = /^\d{15,22}$/;

/**
 * Owns the Discord always-on surface's Mongo state: the guild/channel catalog
 * kept in sync by DiscordSocketService, and the DM identity links (mirroring
 * AuthRepository's Slack-linking methods — see auth.repository.ts's "Slack
 * surface linking" section). A single global bot token serves every guild
 * (unlike Slack's per-workspace OAuth token), so there's no per-guild bot
 * token to store here.
 */
@Injectable()
export class DiscordRepository {
  private indexesReady?: Promise<void>;

  private ensureIndexes(): Promise<void> {
    this.indexesReady ??= (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection("discord_guilds").createIndex({ guildId: 1 }, { unique: true }),
        db.collection("discord_channels").createIndex({ channelId: 1 }, { unique: true }),
        db.collection("discord_channels").createIndex({ guildId: 1 }),
        db.collection("discord_links").createIndex({ discordKey: 1 }, { unique: true }),
        db.collection("discord_links").createIndex({ userId: 1 }, { unique: true }),
        db
          .collection("discord_link_tokens")
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]).catch(() => undefined);
    })();
    return this.indexesReady;
  }

  // --- Guild / channel catalog ----------------------------------------

  async upsertGuild(guildId: string, name: string): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("discord_guilds").updateOne(
      { guildId },
      { $set: { guildId, name }, $setOnInsert: { joinedAt: new Date() } },
      { upsert: true },
    );
  }

  async upsertChannel(guildId: string, channelId: string, name: string, type: number): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("discord_channels").updateOne(
      { channelId },
      { $set: { guildId, channelId, name, type, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async bulkUpsertChannels(
    guildId: string,
    channels: Array<{ id: string; name: string; type: number }>,
  ): Promise<void> {
    if (channels.length === 0) return;
    await this.ensureIndexes();
    const db = await getDb();
    const collection = db.collection("discord_channels");
    await Promise.all(
      channels.map((channel) =>
        collection.updateOne(
          { channelId: channel.id },
          {
            $set: {
              guildId,
              channelId: channel.id,
              name: channel.name,
              type: channel.type,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        ),
      ),
    );
  }

  async removeChannel(channelId: string): Promise<void> {
    const db = await getDb();
    await db.collection("discord_channels").deleteOne({ channelId });
  }

  async listChannels(guildId: string): Promise<DiscordChannel[]> {
    const db = await getDb();
    const records = await db
      .collection<DiscordChannel>("discord_channels")
      .find({ guildId })
      .toArray();
    return records.map((r) => ({ guildId: r.guildId, channelId: r.channelId, name: r.name, type: r.type }));
  }

  /**
   * Deterministic, non-AI channel lookup for automation-creation-time name
   * resolution: (a) a raw snowflake is looked up directly, (b) otherwise an
   * exact normalized-name match wins, (c) otherwise a substring match only if
   * it's unique — multiple candidates come back as `ambiguous` so the caller
   * asks the principal to pick rather than guessing. This is the ONLY place a
   * channel name is ever resolved; the trigger itself matches by channelId.
   */
  async resolveChannel(guildId: string, query: string): Promise<DiscordChannelResolution> {
    const trimmed = query.trim();
    if (SNOWFLAKE.test(trimmed)) {
      const channels = await this.listChannels(guildId);
      const match = channels.find((c) => c.channelId === trimmed);
      return match ? { channelId: match.channelId, name: match.name } : null;
    }

    const normalizedQuery = normalizeChannelQuery(trimmed);
    if (!normalizedQuery) return null;
    const channels = await this.listChannels(guildId);

    const exact = channels.filter((c) => normalizeChannelQuery(c.name) === normalizedQuery);
    if (exact.length === 1) return { channelId: exact[0].channelId, name: exact[0].name };
    if (exact.length > 1) {
      return { ambiguous: true, candidates: exact.map((c) => ({ channelId: c.channelId, name: c.name })) };
    }

    const fuzzy = channels.filter((c) => {
      const normalized = normalizeChannelQuery(c.name);
      return normalized.includes(normalizedQuery) || normalizedQuery.includes(normalized);
    });
    if (fuzzy.length === 1) return { channelId: fuzzy[0].channelId, name: fuzzy[0].name };
    if (fuzzy.length > 1) {
      return { ambiguous: true, candidates: fuzzy.map((c) => ({ channelId: c.channelId, name: c.name })) };
    }
    return null;
  }

  // --- DM identity linking (mirrors AuthRepository's Slack-link methods) --

  async createDiscordLinkToken(email: string, ttlMs: number): Promise<string> {
    await this.ensureIndexes();
    const db = await getDb();
    const collection = db.collection<{ token: string; email: string; expiresAt: Date }>(
      "discord_link_tokens",
    );

    const existing = await collection.findOne({ email, expiresAt: { $gt: new Date() } });
    if (existing) return existing.token;

    const token = randomBytes(16).toString("base64url");
    await collection.deleteMany({ email });
    await collection.insertOne({
      token,
      email,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  async consumeDiscordLinkToken(
    token: string,
    discordKey?: string,
  ): Promise<{ email: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const now = new Date();
    const collection = db.collection<{
      token: string;
      email: string;
      expiresAt: Date;
      claimedByDiscordKey?: string;
      claimedAt?: Date;
    }>("discord_link_tokens");

    if (discordKey) {
      const record = await collection.findOneAndUpdate(
        {
          token,
          expiresAt: { $gt: now },
          $or: [{ claimedByDiscordKey: { $exists: false } }, { claimedByDiscordKey: discordKey }],
        },
        { $set: { claimedByDiscordKey: discordKey, claimedAt: now } },
        { returnDocument: "after" },
      );
      return record ? { email: record.email } : null;
    }

    const record = await collection.findOneAndDelete({ token });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { email: record.email };
  }

  /** One-to-one, same contract as linkSlackUser: an identity already owned by a *different* account is refused, not stolen. */
  async linkDiscordUser(
    discordKey: string,
    email: string,
    userId: string,
    dmChannelId?: string,
  ): Promise<{ ok: true } | { ok: false; linkedEmail: string }> {
    await this.ensureIndexes();
    const db = await getDb();
    const links = db.collection<{
      discordKey: string;
      userId: string;
      email?: string;
      dmChannelId?: string;
    }>("discord_links");

    const existing = await links.findOne({ discordKey });
    if (existing && existing.userId !== userId) {
      return { ok: false, linkedEmail: existing.email ?? existing.userId };
    }

    await links.deleteMany({ $or: [{ discordKey }, { userId }] });
    await links.insertOne({
      discordKey,
      email,
      userId,
      dmChannelId,
      linkedAt: new Date(),
    } as never);
    return { ok: true };
  }

  async unlinkDiscordUser(userId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.collection("discord_links").deleteMany({ userId });
    return result.deletedCount > 0;
  }

  async findUserIdByDiscordKey(discordKey: string): Promise<string | null> {
    const db = await getDb();
    const record = await db
      .collection<{ discordKey: string; userId: string }>("discord_links")
      .findOne({ discordKey });
    return record?.userId ?? null;
  }

  async findDiscordLinkByKey(
    discordKey: string,
  ): Promise<{ userId: string; email?: string } | null> {
    const db = await getDb();
    const record = await db
      .collection<{ discordKey: string; userId: string; email?: string }>("discord_links")
      .findOne({ discordKey });
    return record ? { userId: record.userId, email: record.email } : null;
  }

  /** Reverse lookup for proactive sends — a user's Discord DM channel, if linked. */
  async findDiscordDmChannelByUserId(userId: string): Promise<string | null> {
    const db = await getDb();
    const record = await db
      .collection<{ userId: string; dmChannelId?: string }>("discord_links")
      .findOne({ userId });
    return record?.dmChannelId ?? null;
  }

  /** Every linked Discord DM, for replaying messages missed during a socket outage. */
  async listDiscordLinks(): Promise<
    Array<{ discordKey: string; userId: string; dmChannelId?: string }>
  > {
    const db = await getDb();
    const records = await db
      .collection<{ discordKey: string; userId: string; dmChannelId?: string }>("discord_links")
      .find({ dmChannelId: { $exists: true } })
      .toArray();
    return records.map((r) => ({
      discordKey: r.discordKey,
      userId: r.userId,
      dmChannelId: r.dmChannelId,
    }));
  }
}
