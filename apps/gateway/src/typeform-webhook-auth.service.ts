import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Typeform signs with a secret we set ourselves when registering the webhook
 * (PUT /forms/{id}/webhooks/{tag}), stored per connected account alongside
 * the form it scopes to — so resolution (by form_id) happens before
 * verification, same shape as Calendly. Header is "sha256=<base64 hmac>".
 */
@Injectable()
export class TypeformWebhookAuthService {
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

    const formResponse = (body.form_response as Record<string, unknown> | undefined) ?? {};
    const formId =
      typeof formResponse.form_id === "string"
        ? formResponse.form_id
        : ((formResponse.definition as Record<string, unknown> | undefined)?.id as string | undefined);
    if (!formId) {
      logger.warn("typeform webhook missing form id; dropping");
      return undefined;
    }

    const secret = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.typeform.webhookSecret", { formId })
      .catch(() => undefined);
    if (!secret) {
      logger.warn("typeform webhook: no stored secret for form; dropping", { formId });
      return undefined;
    }

    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("base64")}`;
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("typeform webhook signature mismatch; dropping");
      return undefined;
    }
    return body;
  }
}
