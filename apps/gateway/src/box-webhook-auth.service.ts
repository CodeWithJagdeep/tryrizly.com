import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

const MAX_DELIVERY_AGE_MS = 10 * 60 * 1000; // Box's documented replay-protection window.

/**
 * Box v2 webhooks sign with TWO headers (box-signature-primary/-secondary),
 * one per active signing key — key rotation means either may currently be
 * valid, so verification must accept whichever matches, not just the first.
 * The signed material is body + deliveryTimestamp, not the body alone.
 */
@Injectable()
export class BoxWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    primarySignature: string | undefined,
    secondarySignature: string | undefined,
    deliveryTimestamp: string | undefined,
  ): Promise<{ folderId: string; body: Record<string, unknown> } | undefined> {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }

    const source = (body.source as Record<string, unknown> | undefined) ?? {};
    const folderId = typeof source.id === "string" && source.type === "folder" ? source.id : undefined;
    if (!folderId) {
      logger.warn("box webhook missing folder id in source; dropping");
      return undefined;
    }

    if (!deliveryTimestamp || Date.now() - Date.parse(deliveryTimestamp) > MAX_DELIVERY_AGE_MS) {
      logger.warn("box webhook delivery timestamp missing or stale; dropping (replay protection)");
      return undefined;
    }

    const keys = await this.gatewayService
      .sendToAiCore<{ primary?: string; secondary?: string } | undefined>("connector.box.signatureKeys", { folderId })
      .catch(() => undefined);
    if (!keys?.primary && !keys?.secondary) {
      logger.warn("box webhook: no stored signing key for folder; dropping", { folderId });
      return undefined;
    }

    const signedPayload = Buffer.concat([rawBody, Buffer.from(deliveryTimestamp)]);
    const matches = (key: string | undefined, signature: string | undefined) => {
      if (!key || !signature) return false;
      const expected = createHmac("sha256", key).update(signedPayload).digest("base64");
      return safeEqual(signature, expected);
    };

    if (!matches(keys.primary, primarySignature) && !matches(keys.secondary, secondarySignature)) {
      logger.warn("box webhook signature mismatch on both keys; dropping");
      return undefined;
    }

    return { folderId, body };
  }
}
