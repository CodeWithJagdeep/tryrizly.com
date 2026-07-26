import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { GatewayService } from "./gateway.service";

const PAYPAL_API = "https://api-m.paypal.com";

/**
 * PayPal has no local HMAC scheme at all — unlike every other provider in
 * this file, verifying a webhook means calling PayPal's own
 * /v1/notifications/verify-webhook-signature endpoint per event, which
 * itself needs a fresh OAuth2 access token (client-credentials grant) plus
 * the stored `webhookId` from registration. There's also no reliable
 * account-identifying field in the payload to look up by first, so this
 * tries every connected PayPal account's credentials in turn — one outbound
 * PayPal API call (token fetch + verify) per candidate account, per
 * incoming webhook. That's a genuine efficiency tradeoff, not an oversight:
 * it's the only resolution strategy PayPal's API leaves available here.
 */
@Injectable()
export class PayPalWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    headers: {
      authAlgo?: string;
      certUrl?: string;
      transmissionId?: string;
      transmissionSig?: string;
      transmissionTime?: string;
    },
  ): Promise<{ userId: string; event: Record<string, unknown> } | undefined> {
    if (
      !headers.authAlgo ||
      !headers.certUrl ||
      !headers.transmissionId ||
      !headers.transmissionSig ||
      !headers.transmissionTime
    ) {
      logger.warn("paypal webhook: missing one or more PAYPAL-* verification headers; dropping");
      return undefined;
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }

    const candidates =
      (await this.gatewayService
        .sendToAiCore<Array<{ userId: string; clientId: string; clientSecret: string; webhookId: string }>>(
          "connector.paypal.allWebhookAccounts",
          {},
        )
        .catch(() => [])) ?? [];

    for (const candidate of candidates) {
      try {
        const token = await this.getAccessToken(candidate.clientId, candidate.clientSecret);
        const response = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            auth_algo: headers.authAlgo,
            cert_url: headers.certUrl,
            transmission_id: headers.transmissionId,
            transmission_sig: headers.transmissionSig,
            transmission_time: headers.transmissionTime,
            webhook_id: candidate.webhookId,
            webhook_event: event,
          }),
        });
        if (!response.ok) continue;
        const result = (await response.json()) as { verification_status?: string };
        if (result.verification_status === "SUCCESS") {
          return { userId: candidate.userId, event };
        }
      } catch (error) {
        logger.warn("paypal webhook verification call threw for a candidate account; trying next", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.warn("paypal webhook: no connected account's webhook id verified this event; dropping");
    return undefined;
  }

  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`paypal_auth_${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("paypal_auth_no_token");
    return data.access_token;
  }
}
