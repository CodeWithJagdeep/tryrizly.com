import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { sendEmail } from "@heyriz/shared/email";
import { AuthRepository, type StoredUser } from "./auth.repository";
import { GatewayService } from "../gateway.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export type AuthIdentity = {
  email: string;
  name?: string;
  needsOnboarding?: boolean;
  tokenVersion?: number;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository)
    private readonly repo: AuthRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
  ) {}

  private userIdForEmail(email: string) {
    return normalizeEmail(email);
  }

  /** Tells ai-core the login/signup name so it can sign outbound emails with it. */
  private async syncDisplayName(email: string, name: string | undefined): Promise<void> {
    if (!name) return;
    try {
      await this.gateway.sendToAiCore("user.sync", { userId: this.userIdForEmail(email), name });
    } catch {
      // ai-core may be down; signup/login must not fail because of this.
    }
  }

  /** Set during onboarding (frontend timezone picker) — used for reminders/meeting times. */
  async syncTimezone(email: string, timezone: string): Promise<{ ok: boolean }> {
    try {
      return await this.gateway.sendToAiCore<{ ok: boolean }>("user.sync", {
        userId: this.userIdForEmail(email),
        timezone,
      });
    } catch {
      return { ok: false };
    }
  }

  async register(name: string, email: string, password: string) {
    const normalized = normalizeEmail(email);
    if (await this.repo.getUser(normalized)) {
      return { conflict: true as const };
    }

    const { hash, salt } = hashPassword(password);
    await this.repo.upsertUser(normalized, {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      provider: "password",
      emailVerified: false,
    });

    await this.syncDisplayName(normalized, name);

    const code = makeOtp();
    await this.repo.setOtp(normalized, code, OTP_TTL_MS);
    await sendVerificationEmail(normalized, code);
    return { conflict: false as const, email: normalized };
  }

  async login(email: string, password: string): Promise<AuthIdentity | "unverified" | null> {
    const normalized = normalizeEmail(email);
    const user = await this.repo.getUser(normalized);
    if (!user?.passwordHash || !user.passwordSalt) return null;
    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) return null;
    // Ownership of the mailbox must be proven before password login is honoured.
    // Without this gate the registration OTP is decorative and an attacker could
    // pre-seed an account under someone else's email.
    if (!user.emailVerified) return "unverified";
    return {
      email: normalized,
      name: user.name,
      needsOnboarding: !user.onboarding?.completedAt,
      tokenVersion: user.tokenVersion ?? 0,
    };
  }

  async getTokenVersion(email: string): Promise<number> {
    return this.repo.getTokenVersion(normalizeEmail(email));
  }

  /** Invalidates every outstanding session for the user (logout everywhere). */
  async logout(email: string): Promise<void> {
    await this.repo.incrementTokenVersion(normalizeEmail(email));
  }

  /**
   * Always resolves the same way regardless of whether the address has an
   * account or a password — telling the caller "no account with that email"
   * would let anyone enumerate registered addresses. If a resettable account
   * exists, a real link is emailed; otherwise this is a silent no-op.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.repo.getUser(normalized);
    if (!user?.passwordHash) return;
    const token = await this.repo.createPasswordResetToken(normalized, PASSWORD_RESET_TTL_MS);
    await sendPasswordResetEmail(normalized, token);
  }

  /** Consumes the reset token, sets the new password, and revokes every existing session. */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const record = await this.repo.consumePasswordResetToken(token);
    if (!record) return false;
    const { hash, salt } = hashPassword(newPassword);
    await this.repo.upsertUser(record.email, { passwordHash: hash, passwordSalt: salt });
    await this.repo.incrementTokenVersion(record.email);
    return true;
  }

  async sendVerification(email: string) {
    const normalized = normalizeEmail(email);
    const code = makeOtp();
    await this.repo.setOtp(normalized, code, OTP_TTL_MS);
    await sendVerificationEmail(normalized, code);
  }

  async verifyOtp(email: string, otp: string): Promise<AuthIdentity | null> {
    const normalized = normalizeEmail(email);
    if (!(await this.repo.consumeOtp(normalized, otp))) return null;
    await this.repo.markEmailVerified(normalized);
    const user = await this.repo.getUser(normalized);
    return {
      email: normalized,
      name: user?.name,
      needsOnboarding: !user?.onboarding?.completedAt,
      tokenVersion: user?.tokenVersion ?? 0,
    };
  }

  async createOAuthState(provider: string, returnTo: string): Promise<string> {
    const state = randomBytes(24).toString("base64url");
    await this.repo.setOAuthState(provider, state, { returnTo: sanitizeReturnPath(returnTo) }, OAUTH_STATE_TTL_MS);
    return state;
  }

  async completeGoogleOAuth(code: string, state: string): Promise<{ identity: AuthIdentity; returnTo: string } | null> {
    const stateRecord = await this.repo.consumeOAuthState("google", state);
    if (!stateRecord) return null;
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_LOGIN_REDIRECT_URI) {
      throw new Error("Google OAuth env vars are missing");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.GOOGLE_LOGIN_REDIRECT_URI,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed: ${await tokenResponse.text()}`);
    }

    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new Error("Google token exchange returned no access_token");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error("Failed to fetch Google profile");
    }

    const profile = (await profileResponse.json()) as { email?: string; name?: string };
    if (!profile.email) {
      throw new Error("Google profile has no email");
    }

    const normalizedEmail = normalizeEmail(profile.email);
    const existing = await this.repo.getUser(normalizedEmail);
    await this.repo.upsertUser(normalizedEmail, { name: profile.name, provider: "google" });
    // A Google sign-in proves the mailbox. If a password had been pre-seeded on
    // this address without ever being verified, it belongs to whoever registered
    // it — not necessarily this Google account holder — so drop it.
    await this.repo.markEmailVerified(normalizedEmail, {
      clearPassword: Boolean(existing?.passwordHash && !existing.emailVerified),
    });
    await this.syncDisplayName(normalizedEmail, profile.name);
    return {
      identity: {
        email: normalizedEmail,
        name: profile.name,
        needsOnboarding: !existing?.onboarding?.completedAt,
        tokenVersion: existing?.tokenVersion ?? 0,
      },
      returnTo: stateRecord.returnTo,
    };
  }

  async completeLinkedInOAuth(code: string, state: string): Promise<{ identity: AuthIdentity; returnTo: string } | null> {
    const stateRecord = await this.repo.consumeOAuthState("linkedin", state);
    if (!stateRecord) return null;

    const clientId = env.LINKEDIN_CLIENT_ID;
    const clientSecret = env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("LinkedIn OAuth env vars are missing");
    }

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error("LinkedIn token exchange failed");
    }

    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new Error("LinkedIn token exchange returned no access_token");
    }

    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error("Failed to fetch LinkedIn profile");
    }

    const profile = (await profileResponse.json()) as {
      email?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };
    if (!profile.email) {
      throw new Error("LinkedIn profile has no email");
    }

    const name =
      profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ") || undefined;
    const normalizedEmail = normalizeEmail(profile.email);
    const existing = await this.repo.getUser(normalizedEmail);
    await this.repo.upsertUser(normalizedEmail, { name, provider: "linkedin" });
    // See completeGoogleOAuth: an OAuth sign-in proves the mailbox and neutralises
    // any unverified password another party may have pre-seeded on this address.
    await this.repo.markEmailVerified(normalizedEmail, {
      clearPassword: Boolean(existing?.passwordHash && !existing.emailVerified),
    });
    await this.syncDisplayName(normalizedEmail, name);
    return {
      identity: {
        email: normalizedEmail,
        name,
        needsOnboarding: !existing?.onboarding?.completedAt,
        tokenVersion: existing?.tokenVersion ?? 0,
      },
      returnTo: stateRecord.returnTo,
    };
  }

  async getOnboardingStatus(email: string): Promise<StoredUser["onboarding"] | null> {
    const user = await this.repo.getUser(normalizeEmail(email));
    return user?.onboarding ?? null;
  }

  async patchOnboarding(
    email: string,
    patch: { source?: string; googleConnected?: boolean; completedAt?: string; dashboardTourSeenAt?: string },
  ) {
    const normalized = normalizeEmail(email);
    // Guard: if the DB was wiped but the JWT is still valid, the user document
    // won't exist. upsertUser is idempotent — no-op for existing docs.
    await this.repo.upsertUser(normalized, {});
    await this.repo.setOnboarding(normalized, patch);
  }

  async createTelegramLinkToken(email: string): Promise<string> {
    return this.repo.createTelegramLinkToken(normalizeEmail(email), 15 * 60 * 1000);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = hashPassword(password, salt).hash;
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function makeOtp() {
  return String(randomInt(100000, 1000000));
}

function sanitizeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(value, "https://heyriz.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: email,
    subject: "Reset your Rizly password",
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `<p><a href="${resetUrl}">Reset your Rizly password</a></p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });
  if (!sent && env.RESEND_API_KEY) {
    throw new Error("Failed to send password reset email");
  }
}

async function sendVerificationEmail(email: string, code: string) {
  const sent = await sendEmail({
    to: email,
    subject: "Your Rizly verification code",
    text: `Your Rizly verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Rizly verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
  // Dev fallback (no Resend configured) logs and returns false silently — fine.
  // A configured-but-failed send should surface to the caller.
  if (!sent && env.RESEND_API_KEY) {
    throw new Error("Failed to send verification email");
  }
}
