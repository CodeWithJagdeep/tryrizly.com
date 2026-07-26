import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // Stripe's documented replay-protection window.

/**
 * Stripe's signature scheme isn't a plain HMAC-over-body like most providers
 * here: the Stripe-Signature header is `t=<timestamp>,v1=<hex signature>`,
 * and the signed material is `${timestamp}.${rawBody}` (concatenated with a
 * literal period), HMAC-SHA256 keyed by the webhook secret. A stale
 * timestamp (>5 min) is rejected outright as replay protection, per Stripe's
 * own docs.
 */
@Injectable()
export class StripeWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ userId: string; type: string; eventId: string; data: Record<string, unknown> } | undefined> {
    if (!signatureHeader) {
      logger.warn("stripe webhook: missing Stripe-Signature header; dropping");
      return undefined;
    }

    const parts: Record<string, string> = {};
    for (const kv of signatureHeader.split(",")) {
      const [key, value] = kv.split("=");
      if (key && value) parts[key] = value;
    }
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) {
      logger.warn("stripe webhook: malformed Stripe-Signature header; dropping");
      return undefined;
    }
    if (Math.abs(Date.now() - Number(timestamp) * 1000) > MAX_TIMESTAMP_AGE_MS) {
      logger.warn("stripe webhook: timestamp too old; dropping (replay protection)");
      return undefined;
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }
    const eventId = typeof body.id === "string" ? body.id : undefined;
    const type = typeof body.type === "string" ? body.type : undefined;
    const dataObject = ((body.data as Record<string, unknown> | undefined)?.object ?? undefined) as
      | Record<string, unknown>
      | undefined;
    if (!eventId || !type || !dataObject) return undefined;

    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const computeSignature = (secret: string) => createHmac("sha256", secret).update(signedPayload).digest("hex");

    const accountId = typeof body.account === "string" ? body.account : undefined;
    let matchedUserId: string | undefined;

    if (accountId) {
      // Connect events carry `account` directly — look up that one account's secret.
      const match = await this.gatewayService
        .sendToAiCore<{ userId: string; secret: string } | undefined>("connector.stripe.webhookSecretByAccount", {
          stripeAccountId: accountId,
        })
        .catch(() => undefined);
      if (match && safeEqual(computeSignature(match.secret), v1)) matchedUserId = match.userId;
    } else {
      // Plain manual secret-key connections carry no account identifier at
      // all — there's no cheaper lookup, so every connected Stripe account's
      // stored secret has to be tried until one produces a valid signature.
      const candidates =
        (await this.gatewayService
          .sendToAiCore<Array<{ userId: string; secret: string }>>("connector.stripe.allWebhookSecrets", {})
          .catch(() => [])) ?? [];
      for (const candidate of candidates) {
        if (safeEqual(computeSignature(candidate.secret), v1)) {
          matchedUserId = candidate.userId;
          break;
        }
      }
    }

    if (!matchedUserId) {
      logger.warn("stripe webhook signature mismatch against all stored secrets; dropping");
      return undefined;
    }

    return { userId: matchedUserId, type, eventId, data: dataObject };
  }
}
