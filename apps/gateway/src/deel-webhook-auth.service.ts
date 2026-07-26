import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Confirmed against developer.deel.com/docs/webhooks-verification-examples:
 * the header is x-deel-signature, and the hashed material is the literal
 * string "POST" concatenated with the raw body (not the raw body alone) —
 * easy to miss since most providers just HMAC the body.
 */
const DEEL_SIGNATURE_HEADER = "x-deel-signature";

@Injectable()
export class DeelWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  /** organizationId comes from the payload's meta.organization_id — needed to look up the right connected account's signing key before we can verify anything. */
  async verify(rawBody: Buffer, signatureHeader: string | undefined, organizationId: string): Promise<boolean> {
    if (!signatureHeader) {
      logger.warn(`deel webhook: missing ${DEEL_SIGNATURE_HEADER} header; dropping`);
      return false;
    }
    const secret = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.deel.signingKey", { organizationId })
      .catch(() => undefined);
    if (!secret) {
      logger.warn("deel webhook: no stored signing secret for this organization; dropping");
      return false;
    }
    const expected = createHmac("sha256", secret).update("POST").update(rawBody).digest("hex");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("deel webhook signature mismatch; dropping");
      return false;
    }
    return true;
  }
}

export { DEEL_SIGNATURE_HEADER };
