import { createHmac } from "crypto";
import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";

/**
 * Xero's webhook handshake is "intent to receive": Xero periodically POSTs
 * `{ events: [] }` and expects a 200 within 5s AND the correct
 * x-xero-signature echoed back — any response without a valid computed
 * signature must be 401 per Xero's spec, even for the empty-events ping.
 * Real events carry only pointers (resourceUrl) — the actual invoice has to
 * be fetched from Xero's API afterward, not read out of the payload.
 */
@Injectable()
export class XeroWebhookAuthService {
  /** Returns the parsed body if the signature is valid, or undefined (drop + 401). */
  verify(rawBody: Buffer, signatureHeader: string | undefined): Record<string, unknown> | undefined {
    if (!signatureHeader || !env.XERO_WEBHOOK_SIGNING_KEY) {
      logger.warn("xero webhook: missing signature header or signing key; dropping");
      return undefined;
    }
    const expected = createHmac("sha256", env.XERO_WEBHOOK_SIGNING_KEY).update(rawBody).digest("base64");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("xero webhook signature mismatch; dropping");
      return undefined;
    }
    try {
      return JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }
  }
}
