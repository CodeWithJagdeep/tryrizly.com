import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Calendly's signing key is per-webhook-subscription (returned once when we
 * register it with the user's own token, see ConnectorService.connectCalendly
 * for where it's stored) rather than one app-wide secret — so unlike Shopify
 * we must resolve which connected account this event's organization maps to
 * before we can even verify it. That resolution + secret lookup lives in
 * ai-core (the only place the connector vault is decryptable); gateway makes
 * one internal call for it. Signature header format: "t=<ts>,v1=<hex hmac>"
 * over "<ts>.<rawBody>".
 */
@Injectable()
export class CalendlyWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<Record<string, unknown> | undefined> {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }

    const payload = (body.payload as Record<string, unknown> | undefined) ?? {};
    const organizationUri = typeof payload.organization === "string" ? payload.organization : undefined;
    if (!organizationUri) {
      logger.warn("calendly webhook missing organization uri; dropping");
      return undefined;
    }

    const signingKey = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.calendly.signingKey", { organizationUri })
      .catch(() => undefined);
    if (!signingKey) {
      logger.warn("calendly webhook: no signing key for organization; dropping", { organizationUri });
      return undefined;
    }

    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) {
      logger.warn("calendly webhook: malformed signature header; dropping");
      return undefined;
    }
    const expected = createHmac("sha256", signingKey).update(`${parsed.t}.${rawBody.toString("utf8")}`).digest("hex");
    if (!safeEqual(parsed.v1, expected)) {
      logger.warn("calendly webhook signature mismatch; dropping");
      return undefined;
    }
    return body;
  }
}

function parseSignatureHeader(header: string | undefined): { t: string; v1: string } | undefined {
  if (!header) return undefined;
  const parts = Object.fromEntries(
    header.split(",").map((pair) => pair.split("=").map((s) => s.trim()) as [string, string]),
  );
  return parts.t && parts.v1 ? { t: parts.t, v1: parts.v1 } : undefined;
}
