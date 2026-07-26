import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Lemon Squeezy's webhook secret is set by us at registration (POST
 * /v1/webhooks) and stored per connected store — resolved here by the
 * store id embedded in the payload before the X-Signature (hex HMAC-SHA256)
 * can be checked.
 */
@Injectable()
export class LemonSqueezyWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ storeId: string; body: Record<string, unknown> } | undefined> {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }

    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const attributes = (data.attributes as Record<string, unknown> | undefined) ?? {};
    const storeId = attributes.store_id !== undefined ? String(attributes.store_id) : undefined;
    if (!storeId) {
      logger.warn("lemon squeezy webhook missing store id; dropping");
      return undefined;
    }

    const secret = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.lemonsqueezy.webhookSecret", { storeId })
      .catch(() => undefined);
    if (!secret) {
      logger.warn("lemon squeezy webhook: no stored secret for store; dropping", { storeId });
      return undefined;
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("lemon squeezy webhook signature mismatch; dropping");
      return undefined;
    }
    return { storeId, body };
  }
}
