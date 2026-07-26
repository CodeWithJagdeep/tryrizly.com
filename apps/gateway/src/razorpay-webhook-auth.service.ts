import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Simpler than Stripe: X-Razorpay-Signature is a plain HMAC-SHA256 of the
 * raw body, hex-encoded — no timestamp prefix, no replay window. Razorpay
 * webhooks also carry no account identifier at all, so (like Stripe's manual
 * mode) every connected account's stored secret has to be tried until one
 * matches.
 */
@Injectable()
export class RazorpayWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ userId: string; event: string; payload: Record<string, unknown> } | undefined> {
    if (!signatureHeader) {
      logger.warn("razorpay webhook: missing X-Razorpay-Signature header; dropping");
      return undefined;
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }
    const event = typeof body.event === "string" ? body.event : undefined;
    if (!event) return undefined;

    const candidates =
      (await this.gatewayService
        .sendToAiCore<Array<{ userId: string; secret: string }>>("connector.razorpay.allWebhookSecrets", {})
        .catch(() => [])) ?? [];

    let matchedUserId: string | undefined;
    for (const candidate of candidates) {
      const expected = createHmac("sha256", candidate.secret).update(rawBody).digest("hex");
      if (safeEqual(signatureHeader, expected)) {
        matchedUserId = candidate.userId;
        break;
      }
    }

    if (!matchedUserId) {
      logger.warn("razorpay webhook signature mismatch against all stored secrets; dropping");
      return undefined;
    }

    return { userId: matchedUserId, event, payload: body };
  }
}
