import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { EmailThrottlerGuard } from "./email-throttler.guard";
import { requireInternalSecret } from "../internal-auth";

@Controller("api/auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
  ) {}

  @Post("register")
  @UseGuards(EmailThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async register(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { name?: string; email?: string; password?: string },
  ) {
    this.requireInternal(secret);
    const name = body.name?.trim();
    const email = body.email?.trim();
    const password = body.password ?? "";
    if (!name || !email || password.length < 8) {
      return { error: "Name, valid email, and 8+ character password are required" };
    }

    const result = await this.auth.register(name, email, password);
    if (result.conflict) {
      return { error: "That email is already registered", conflict: true };
    }
    return { email: result.email, needsVerification: true };
  }

  @Post("login")
  @UseGuards(EmailThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 300_000 } })
  async login(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string; password?: string },
  ) {
    this.requireInternal(secret);
    const identity = await this.auth.login(body.email ?? "", body.password ?? "");
    if (identity === "unverified") {
      return { error: "Please verify your email before signing in.", needsVerification: true };
    }
    if (!identity) {
      return { error: "Invalid email or password" };
    }
    return { identity };
  }

  @Post("email/send-verification")
  @UseGuards(EmailThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  async sendVerification(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string },
  ) {
    this.requireInternal(secret);
    const email = body.email?.trim();
    if (!email) return { error: "Email is required" };
    await this.auth.sendVerification(email);
    return { ok: true };
  }

  @Post("email/verify")
  @UseGuards(EmailThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 600_000 } })
  async verify(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string; otp?: string },
  ) {
    this.requireInternal(secret);
    const identity = await this.auth.verifyOtp(body.email ?? "", body.otp ?? "");
    if (!identity) {
      return { error: "Invalid or expired code" };
    }
    return { identity };
  }

  @Get("session-version")
  async sessionVersion(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("email") email?: string,
  ) {
    this.requireInternal(secret);
    if (!email) return { error: "email is required" };
    return { version: await this.auth.getTokenVersion(email) };
  }

  @Post("logout")
  async logout(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string },
  ) {
    this.requireInternal(secret);
    if (!body.email) return { error: "email is required" };
    await this.auth.logout(body.email);
    return { ok: true };
  }

  @Post("oauth/state")
  async createState(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { provider?: string; returnTo?: string },
  ) {
    this.requireInternal(secret);
    if (!body.provider) return { error: "provider is required" };
    const state = await this.auth.createOAuthState(body.provider, body.returnTo || "/dashboard");
    return { state };
  }

  @Post("oauth/complete")
  async completeOAuth(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { provider?: string; code?: string; state?: string },
  ) {
    this.requireInternal(secret);
    if (!body.code || !body.state) return { error: "Missing code or state" };

    try {
      const result =
        body.provider === "linkedin"
          ? await this.auth.completeLinkedInOAuth(body.code, body.state)
          : await this.auth.completeGoogleOAuth(body.code, body.state);

      if (!result) return { error: "state_expired" };
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "OAuth exchange failed" };
    }
  }

  @Get("onboarding-status")
  async onboardingStatus(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("email") email?: string,
  ) {
    this.requireInternal(secret);
    if (!email) return { error: "email is required" };
    const onboarding = await this.auth.getOnboardingStatus(email);
    if (!onboarding) return { error: "not_found" };
    return { onboarding };
  }

  @Post("onboarding/progress")
  async onboardingProgress(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: { email?: string; source?: string; googleConnected?: boolean; completedAt?: string },
  ) {
    this.requireInternal(secret);
    if (!body.email) return { error: "email is required" };
    await this.auth.patchOnboarding(body.email, {
      source: body.source,
      googleConnected: body.googleConnected,
      completedAt: body.completedAt,
    });
    return { ok: true };
  }

  @Post("onboarding/timezone")
  async onboardingTimezone(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string; timezone?: string },
  ) {
    this.requireInternal(secret);
    const email = body.email?.trim();
    const timezone = body.timezone?.trim();
    if (!email) return { error: "email is required" };
    if (!timezone) return { error: "timezone is required" };
    const result = await this.auth.syncTimezone(email, timezone);
    if (!result.ok) return { error: "invalid_or_unreachable" };
    return { ok: true };
  }

  @Post("onboarding/telegram-token")
  async telegramToken(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { email?: string },
  ) {
    this.requireInternal(secret);
    if (!body.email) return { error: "email is required" };
    const token = await this.auth.createTelegramLinkToken(body.email);
    return { token };
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }
}
