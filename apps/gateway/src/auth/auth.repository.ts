import { randomBytes, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";
import { getDb } from "@heyriz/shared/db/mongo";

export type OnboardingState = {
  source?: string;
  googleConnected: boolean;
  telegramLinked: boolean;
  slackLinked?: boolean;
  discordLinked?: boolean;
  /** Set once the About-you onboarding step (name + optional phone) is saved. */
  profileCompleted?: boolean;
  completedAt?: string;
  /** Set once the dashboard's first-run welcome tour has been shown/dismissed. */
  dashboardTourSeenAt?: string;
};

export type StoredUser = {
  email: string;
  name?: string;
  /** E.164-ish, dial code included (e.g. "+91 9876543210"). Optional — collected in onboarding. */
  phone?: string;
  passwordHash?: string;
  passwordSalt?: string;
  provider?: string;
  /** True only once the address has been proven — OTP entered, or an OAuth
   * sign-in that inherently proves the mailbox. Login is gated on this. */
  emailVerified?: boolean;
  /** Monotonic session epoch. Baked into issued JWTs; bumping it invalidates
   * every outstanding token for the user (logout / "sign out everywhere"). */
  tokenVersion?: number;
  onboarding: OnboardingState;
};

export type OAuthStateRecord = {
  returnTo: string;
  redirectUri?: string;
};

const defaultOnboarding: OnboardingState = {
  googleConnected: false,
  telegramLinked: false,
};

/**
 * Owns every Mongo collection backing auth/onboarding/telegram-linking.
 * `web` and `apps/gateway/telegram.service.ts` go through this — nothing
 * outside `gateway` should open its own Mongo client for this data.
 */
@Injectable()
export class AuthRepository {
  private indexesReady?: Promise<void>;

  private ensureIndexes(): Promise<void> {
    this.indexesReady ??= (async () => {
      const db = await getDb();
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      await db.collection("otp_codes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection("oauth_states").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db
        .collection("telegram_link_tokens")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db
        .collection("slack_link_tokens")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db
        .collection("password_reset_tokens")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      // Best-effort: if legacy duplicate links exist, index creation fails —
      // don't let that take down every auth query; linkTelegramChat's
      // delete-before-insert still enforces uniqueness going forward.
      await Promise.all([
        db.collection("telegram_links").createIndex({ chatId: 1 }, { unique: true }),
        db.collection("telegram_links").createIndex({ userId: 1 }, { unique: true }),
        db.collection("slack_links").createIndex({ slackKey: 1 }, { unique: true }),
        db.collection("slack_links").createIndex({ userId: 1 }, { unique: true }),
        db.collection("slack_workspaces").createIndex({ teamId: 1 }, { unique: true }),
      ]).catch(() => undefined);
    })();
    return this.indexesReady;
  }

  async getUser(email: string): Promise<StoredUser | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const doc = await db.collection<StoredUser>("users").findOne({ email });
    return doc ? { ...doc, onboarding: doc.onboarding ?? defaultOnboarding } : null;
  }

  async upsertUser(
    email: string,
    fields: Partial<Omit<StoredUser, "email" | "onboarding">>,
  ): Promise<StoredUser> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection<StoredUser>("users").updateOne(
      { email },
      {
        $set: fields,
        $setOnInsert: { email, onboarding: defaultOnboarding },
      },
      { upsert: true },
    );
    const user = await this.getUser(email);
    if (!user) throw new Error("Failed to upsert user");
    return user;
  }

  async setOnboarding(email: string, patch: Partial<OnboardingState>) {
    await this.ensureIndexes();
    const db = await getDb();
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      set[`onboarding.${key}`] = value;
    }
    await db.collection("users").updateOne({ email }, { $set: set });
  }

  async setOtp(email: string, code: string, ttlMs: number) {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("otp_codes").updateOne(
      { email },
      { $set: { email, code, expiresAt: new Date(Date.now() + ttlMs) } },
      { upsert: true },
    );
  }

  async consumeOtp(email: string, code: string): Promise<boolean> {
    await this.ensureIndexes();
    const db = await getDb();
    const record = await db
      .collection<{ code: string; expiresAt: Date }>("otp_codes")
      .findOne({ email });
    if (!record || record.expiresAt.getTime() < Date.now() || !codesMatch(record.code, code)) {
      return false;
    }
    await db.collection("otp_codes").deleteOne({ email });
    return true;
  }

  /**
   * Marks the address as proven. `clearPassword` unsets any stored password —
   * used when an OAuth sign-in proves ownership of an email that a *different*
   * party had pre-seeded with a password (unverified), neutralising that
   * pre-account-takeover vector.
   */
  async getTokenVersion(email: string): Promise<number | null> {
    const user = await this.getUser(email);
    return user ? (user.tokenVersion ?? 0) : null;
  }

  /** Bumps the session epoch so all previously-issued tokens stop validating. */
  async incrementTokenVersion(email: string): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("users").updateOne({ email }, { $inc: { tokenVersion: 1 } });
  }

  async markEmailVerified(email: string, opts?: { clearPassword?: boolean }): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    const update: Record<string, unknown> = { $set: { emailVerified: true } };
    if (opts?.clearPassword) {
      update.$unset = { passwordHash: "", passwordSalt: "" };
    }
    await db.collection("users").updateOne({ email }, update);
  }

  async setOAuthState(provider: string, state: string, data: OAuthStateRecord, ttlMs: number) {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("oauth_states").insertOne({
      provider,
      state,
      ...data,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  async consumeOAuthState(provider: string, state: string): Promise<OAuthStateRecord | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const record = await db
      .collection<{
        provider: string;
        state: string;
        returnTo: string;
        redirectUri?: string;
        expiresAt: Date;
      }>(
        "oauth_states",
      )
      .findOneAndDelete({ provider, state });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { returnTo: record.returnTo, redirectUri: record.redirectUri };
  }

  /**
   * Single-use, short-lived password reset token. Any existing token for the
   * email is invalidated first — a reset link only works if it's the most
   * recently requested one, so an old leaked/forwarded email can't be used
   * after the user has requested (and presumably used) a newer one.
   */
  async createPasswordResetToken(email: string, ttlMs: number): Promise<string> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("password_reset_tokens").deleteMany({ email });
    const token = randomBytes(32).toString("base64url");
    await db.collection("password_reset_tokens").insertOne({
      token,
      email,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  async consumePasswordResetToken(token: string): Promise<{ email: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const record = await db
      .collection<{ token: string; email: string; expiresAt: Date }>("password_reset_tokens")
      .findOneAndDelete({ token });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { email: record.email };
  }

  /**
   * Idempotent: reuses an existing still-valid token instead of always
   * minting a new one. The onboarding page re-fires this on every visit to
   * the Telegram step (including navigating back and forward again), and
   * unconditionally deleting-and-replacing here would invalidate a token the
   * principal already opened in Telegram, right as they're clicking /start —
   * exactly the "link has expired" report this was causing.
   */
  async createTelegramLinkToken(email: string, ttlMs: number): Promise<string> {
    await this.ensureIndexes();
    const db = await getDb();
    const collection = db.collection<{ token: string; email: string; expiresAt: Date }>(
      "telegram_link_tokens",
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

  async consumeTelegramLinkToken(
    token: string,
    chatId?: string,
  ): Promise<{ email: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const now = new Date();
    const collection = db.collection<{
      token: string;
      email: string;
      expiresAt: Date;
      claimedByChatId?: string;
      claimedAt?: Date;
    }>("telegram_link_tokens");

    if (chatId) {
      const record = await collection.findOneAndUpdate(
        {
          token,
          expiresAt: { $gt: now },
          $or: [{ claimedByChatId: { $exists: false } }, { claimedByChatId: chatId }],
        },
        { $set: { claimedByChatId: chatId, claimedAt: now } },
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

  /**
   * Links a Telegram chat to an account. A chat belongs to exactly one
   * account and an account to one chat — two accounts on one chat means
   * scheduled sends (morning brief etc.) fan out once per account into the
   * same chat, and inbound messages resolve to an arbitrary one. A chat
   * already owned by a *different* account is therefore refused, not stolen;
   * the owner must unlink from their dashboard first.
   */
  async linkTelegramChat(
    chatId: string,
    email: string,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; linkedEmail: string }> {
    const db = await getDb();
    const links = db.collection<{ chatId: string; userId: string; email?: string }>("telegram_links");

    const existing = await links.findOne({ chatId });
    if (existing && existing.userId !== userId) {
      return { ok: false, linkedEmail: existing.email ?? existing.userId };
    }

    // Same account relinking (possibly from a new chat): drop any stale link
    // on either side, then write the fresh one.
    await links.deleteMany({ $or: [{ chatId }, { userId }] });
    await links.insertOne({ chatId, email, userId, linkedAt: new Date() } as never);
    await this.setOnboarding(email, { telegramLinked: true, completedAt: new Date().toISOString() });
    return { ok: true };
  }

  /** Unlink this user's Telegram chat. Returns true if a link was removed. */
  async unlinkTelegramChat(userId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.collection("telegram_links").deleteMany({ userId });
    return result.deletedCount > 0;
  }

  async findUserIdByTelegramChat(chatId: string): Promise<string | null> {
    const db = await getDb();
    const record = await db.collection<{ chatId: string; userId: string }>("telegram_links").findOne({
      chatId,
    });
    return record?.userId ?? null;
  }

  async findTelegramLinkByChat(chatId: string): Promise<{ userId: string; email?: string } | null> {
    const db = await getDb();
    const record = await db
      .collection<{ chatId: string; userId: string; email?: string }>("telegram_links")
      .findOne({ chatId });
    return record ? { userId: record.userId, email: record.email } : null;
  }

  /** Reverse of findUserIdByTelegramChat — used by the web dashboard to find a user's chat for pending approvals. */
  async findTelegramChatIdByUserId(userId: string): Promise<string | null> {
    const db = await getDb();
    const record = await db.collection<{ chatId: string; userId: string }>("telegram_links").findOne({
      userId,
    });
    return record?.chatId ?? null;
  }

  async countTelegramLinks(): Promise<number> {
    const db = await getDb();
    return db.collection("telegram_links").countDocuments();
  }

  /**
   * Slack surface linking, mirroring the Telegram flow. A Slack identity is
   * keyed `teamId:slackUserId` (Slack user ids are only unique per workspace).
   * Same idempotent-token semantics as createTelegramLinkToken — see that
   * method's comment for why we reuse a still-valid token.
   */
  async createSlackLinkToken(email: string, ttlMs: number): Promise<string> {
    await this.ensureIndexes();
    const db = await getDb();
    const collection = db.collection<{ token: string; email: string; expiresAt: Date }>(
      "slack_link_tokens",
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

  async consumeSlackLinkToken(
    token: string,
    slackKey?: string,
  ): Promise<{ email: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const now = new Date();
    const collection = db.collection<{
      token: string;
      email: string;
      expiresAt: Date;
      claimedBySlackKey?: string;
      claimedAt?: Date;
    }>("slack_link_tokens");

    if (slackKey) {
      const record = await collection.findOneAndUpdate(
        {
          token,
          expiresAt: { $gt: now },
          $or: [{ claimedBySlackKey: { $exists: false } }, { claimedBySlackKey: slackKey }],
        },
        { $set: { claimedBySlackKey: slackKey, claimedAt: now } },
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

  /**
   * Links a Slack identity to an account with the same one-to-one contract as
   * linkTelegramChat: an identity already owned by a *different* account is
   * refused, not stolen. `dmChannelId` is the bot↔user DM channel, stored so
   * proactive sends don't need a conversations.open round-trip.
   */
  async linkSlackUser(
    slackKey: string,
    email: string,
    userId: string,
    dmChannelId?: string,
  ): Promise<{ ok: true } | { ok: false; linkedEmail: string }> {
    const db = await getDb();
    const links = db.collection<{
      slackKey: string;
      userId: string;
      email?: string;
      dmChannelId?: string;
    }>("slack_links");

    const existing = await links.findOne({ slackKey });
    if (existing && existing.userId !== userId) {
      return { ok: false, linkedEmail: existing.email ?? existing.userId };
    }

    await links.deleteMany({ $or: [{ slackKey }, { userId }] });
    await links.insertOne({
      slackKey,
      email,
      userId,
      dmChannelId,
      linkedAt: new Date(),
    } as never);
    await this.setOnboarding(email, { slackLinked: true, completedAt: new Date().toISOString() });
    return { ok: true };
  }

  /** Unlink this user's Slack identity. Returns true if a link was removed. */
  async unlinkSlackUser(userId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.collection("slack_links").deleteMany({ userId });
    return result.deletedCount > 0;
  }

  async findUserIdBySlackKey(slackKey: string): Promise<string | null> {
    const db = await getDb();
    const record = await db
      .collection<{ slackKey: string; userId: string }>("slack_links")
      .findOne({ slackKey });
    return record?.userId ?? null;
  }

  async findSlackLinkByKey(
    slackKey: string,
  ): Promise<{ userId: string; email?: string } | null> {
    const db = await getDb();
    const record = await db
      .collection<{ slackKey: string; userId: string; email?: string }>("slack_links")
      .findOne({ slackKey });
    return record ? { userId: record.userId, email: record.email } : null;
  }

  /**
   * Workspace bot tokens from "Add to Slack" OAuth installs. The home
   * workspace (where the app was manually installed) keeps using the env
   * token; every other workspace's token lives here, keyed by team.
   */
  async saveSlackWorkspace(teamId: string, botToken: string, teamName?: string): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("slack_workspaces").updateOne(
      { teamId },
      { $set: { teamId, botToken, teamName, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async findSlackBotTokenByTeam(teamId: string): Promise<string | null> {
    const db = await getDb();
    const record = await db
      .collection<{ teamId: string; botToken: string }>("slack_workspaces")
      .findOne({ teamId });
    return record?.botToken ?? null;
  }

  /** Reverse lookup for proactive sends — a user's Slack DM channel, if linked. */
  async findSlackDmChannelByUserId(userId: string): Promise<string | null> {
    const db = await getDb();
    const record = await db
      .collection<{ userId: string; dmChannelId?: string }>("slack_links")
      .findOne({ userId });
    return record?.dmChannelId ?? null;
  }

  /** Full Slack link for a user — slackKey embeds the teamId (`teamId:slackUserId`). */
  async findSlackLinkByUserId(
    userId: string,
  ): Promise<{ slackKey: string; dmChannelId?: string } | null> {
    const db = await getDb();
    const record = await db
      .collection<{ userId: string; slackKey: string; dmChannelId?: string }>("slack_links")
      .findOne({ userId });
    return record ? { slackKey: record.slackKey, dmChannelId: record.dmChannelId } : null;
  }

  /**
   * Every linked Slack DM, for replaying messages missed during a Socket Mode
   * outage. `slackKey` is `teamId:slackUserId` (see SlackSurfaceService.slackKey).
   */
  async listSlackLinks(): Promise<
    Array<{ slackKey: string; userId: string; dmChannelId?: string }>
  > {
    const db = await getDb();
    const records = await db
      .collection<{ slackKey: string; userId: string; dmChannelId?: string }>("slack_links")
      .find({ dmChannelId: { $exists: true } })
      .toArray();
    return records.map((r) => ({ slackKey: r.slackKey, userId: r.userId, dmChannelId: r.dmChannelId }));
  }

  /**
   * Every one of our userIds linked into a given Slack workspace — used to
   * scope workspace-wide triggers ("New Mention", "New Reaction Added") that
   * have no channelId to match on. slackKey is `teamId:slackUserId`, so a
   * prefix match finds every user linked to that team (multiple users can
   * share one workspace once the bot's installed there).
   */
  async findUserIdsByTeamId(teamId: string): Promise<string[]> {
    const db = await getDb();
    const records = await db
      .collection<{ slackKey: string; userId: string }>("slack_links")
      .find({ slackKey: { $regex: `^${teamId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:` } })
      .toArray();
    return [...new Set(records.map((r) => r.userId))];
  }

  /** Web Push subscriptions — fallback notification channel for users without Telegram. */
  async savePushSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    const db = await getDb();
    await db.collection("push_subscriptions").updateOne(
      { endpoint: subscription.endpoint },
      { $set: { userId, endpoint: subscription.endpoint, keys: subscription.keys, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    const db = await getDb();
    await db.collection("push_subscriptions").deleteOne({ endpoint });
  }

  async getPushSubscriptions(
    userId: string,
  ): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>> {
    const db = await getDb();
    return db
      .collection<{ userId: string; endpoint: string; keys: { p256dh: string; auth: string } }>(
        "push_subscriptions",
      )
      .find({ userId })
      .limit(10)
      .map(({ endpoint, keys }) => ({ endpoint, keys }))
      .toArray();
  }

  async deleteAccountData(email: string, userId: string): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await Promise.all([
      db.collection("otp_codes").deleteMany({ email }),
      db.collection("password_reset_tokens").deleteMany({ email }),
      db.collection("telegram_link_tokens").deleteMany({ email }),
      db.collection("telegram_links").deleteMany({ $or: [{ userId }, { email }] }),
      db.collection("push_subscriptions").deleteMany({ userId }),
    ]);
    // Delete the identity last. Session-version checks fail closed as soon as
    // this record is absent, invalidating every browser session.
    await db.collection("users").deleteOne({ email });
  }
}

/** Constant-time OTP comparison — avoids leaking correct digits via timing. */
function codesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
