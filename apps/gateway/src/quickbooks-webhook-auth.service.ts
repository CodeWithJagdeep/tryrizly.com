import { createHmac } from "crypto";
import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";

/**
 * Intuit webhook subscriptions are configured once, app-wide, in the Intuit
 * Developer dashboard (Webhooks tab) — there is no per-connection
 * registration API, unlike Calendly/Figma/etc. Every notification is signed
 * with the app-level verifier token shown on that same dashboard page
 * (INTUIT_WEBHOOK_VERIFIER_TOKEN): base64(HMAC-SHA256(rawBody, verifierToken)).
 */
@Injectable()
export class QuickBooksWebhookAuthService {
  verify(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !env.INTUIT_WEBHOOK_VERIFIER_TOKEN) {
      logger.warn("quickbooks webhook: missing signature header or verifier token; dropping");
      return false;
    }
    const expected = createHmac("sha256", env.INTUIT_WEBHOOK_VERIFIER_TOKEN).update(rawBody).digest("base64");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("quickbooks webhook signature mismatch; dropping");
      return false;
    }
    return true;
  }
}
