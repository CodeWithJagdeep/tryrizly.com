import { randomBytes, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";
import { getDb } from "@heyriz/shared/db/mongo";

export type OnboardingState = {
  source?: string;
  googleConnected: boolean;
  telegramLinked: boolean;
  completedAt?: string;
};

export type StoredUser = {
  email: string;
  name?: string;
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
      // Best-effort: if legacy duplicate links exist, index creation fails —
      // don't let that take down every auth query; linkTelegramChat's
      // delete-before-insert still enforces uniqueness going forward.
      await Promise.all([
        db.collection("telegram_links").createIndex({ chatId: 1 }, { unique: true }),
        db.collection("telegram_links").createIndex({ userId: 1 }, { unique: true }),
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
  async getTokenVersion(email: string): Promise<number> {
    const user = await this.getUser(email);
    return user?.tokenVersion ?? 0;
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

  async setOAuthState(provider: string, state: string, data: { returnTo: string }, ttlMs: number) {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("oauth_states").insertOne({
      provider,
      state,
      ...data,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  async consumeOAuthState(provider: string, state: string): Promise<{ returnTo: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const record = await db
      .collection<{ provider: string; state: string; returnTo: string; expiresAt: Date }>(
        "oauth_states",
      )
      .findOneAndDelete({ provider, state });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { returnTo: record.returnTo };
  }

  async createTelegramLinkToken(email: string, ttlMs: number): Promise<string> {
    await this.ensureIndexes();
    const db = await getDb();
    const token = randomBytes(16).toString("base64url");
    await db.collection("telegram_link_tokens").insertOne({
      token,
      email,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  async consumeTelegramLinkToken(token: string): Promise<{ email: string } | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const record = await db
      .collection<{ token: string; email: string; expiresAt: Date }>("telegram_link_tokens")
      .findOneAndDelete({ token });
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
}

/** Constant-time OTP comparison — avoids leaking correct digits via timing. */
function codesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
