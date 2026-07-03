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

  async linkTelegramChat(chatId: string, email: string, userId: string) {
    const db = await getDb();
    await db.collection("telegram_links").updateOne(
      { chatId },
      { $set: { chatId, email, userId, linkedAt: new Date() } },
      { upsert: true },
    );
    await this.setOnboarding(email, { telegramLinked: true, completedAt: new Date().toISOString() });
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
}

/** Constant-time OTP comparison — avoids leaking correct digits via timing. */
function codesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
