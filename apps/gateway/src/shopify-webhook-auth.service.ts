import { createHmac } from "crypto";
import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";

/**
 * Shopify signs every webhook with the app's own client secret (one secret
 * for the whole app, unlike Calendly/Figma/etc where each connected account
 * has its own key) — so verification never needs a per-user lookup, just the
 * env-configured SHOPIFY_CLIENT_SECRET.
 */
@Injectable()
export class ShopifyWebhookAuthService {
  verify(rawBody: Buffer, hmacHeader: string | undefined): boolean {
    if (!hmacHeader || !env.SHOPIFY_CLIENT_SECRET) {
      logger.warn("shopify webhook: missing signature header or app secret; dropping");
      return false;
    }
    const expected = createHmac("sha256", env.SHOPIFY_CLIENT_SECRET).update(rawBody).digest("base64");
    if (!safeEqual(hmacHeader, expected)) {
      logger.warn("shopify webhook signature mismatch; dropping");
      return false;
    }
    return true;
  }
}
