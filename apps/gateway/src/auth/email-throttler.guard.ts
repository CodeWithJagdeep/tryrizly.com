import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Keys rate limits by the targeted email instead of request IP. Gateway sits
 * behind the web app's internal-secret proxy, so every request's socket IP is
 * the web server's own IP, not the real visitor's — IP-based limiting would
 * throttle all users collectively rather than stopping a single attacker from
 * brute-forcing or OTP-bombing one account. Falls back to IP if no email is
 * present in the body (defense in depth, still useful as a blunt backstop).
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();
    if (email) return `email:${email}`;
    return super.getTracker(req);
  }
}
