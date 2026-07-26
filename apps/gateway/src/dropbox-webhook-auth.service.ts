import { createHmac } from "crypto";
import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";

/**
 * Dropbox signs notifications with the app secret (X-Dropbox-Signature, hex
 * HMAC-SHA256 of the raw body) — one secret for the whole app. The GET
 * challenge handshake (verifying the endpoint at registration time) is simple
 * enough to handle inline in the controller and doesn't need this service.
 */
@Injectable()
export class DropboxWebhookAuthService {
  verify(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !env.DROPBOX_CLIENT_SECRET) {
      logger.warn("dropbox webhook: missing signature header or app secret; dropping");
      return false;
    }
    const expected = createHmac("sha256", env.DROPBOX_CLIENT_SECRET).update(rawBody).digest("hex");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("dropbox webhook signature mismatch; dropping");
      return false;
    }
    return true;
  }
}
