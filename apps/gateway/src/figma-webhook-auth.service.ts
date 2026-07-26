import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { GatewayService } from "./gateway.service";

/**
 * Figma signs with a "passcode" we choose at webhook-registration time
 * (POST /v2/webhooks), stored per connected team — resolved by the team_id
 * in the payload before X-Figma-Signature (hex HMAC-SHA256) can be checked.
 * Registration itself can fail with a plan-tier error (webhooks require an
 * Organization/Enterprise Figma plan) — see ConnectorService.connectFigma.
 */
@Injectable()
export class FigmaWebhookAuthService {
  constructor(
    @Inject(GatewayService)
    private readonly gatewayService: GatewayService,
  ) {}

  async handle(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ teamId: string; body: Record<string, unknown> } | undefined> {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return undefined;
    }

    const teamId = typeof body.team_id === "string" ? body.team_id : undefined;
    if (!teamId) {
      logger.warn("figma webhook missing team id; dropping");
      return undefined;
    }

    const passcode = await this.gatewayService
      .sendToAiCore<string | undefined>("connector.figma.webhookPasscode", { teamId })
      .catch(() => undefined);
    if (!passcode) {
      logger.warn("figma webhook: no stored passcode for team; dropping", { teamId });
      return undefined;
    }

    const expected = createHmac("sha256", passcode).update(rawBody).digest("hex");
    if (!safeEqual(signatureHeader, expected)) {
      logger.warn("figma webhook signature mismatch; dropping");
      return undefined;
    }
    return { teamId, body };
  }
}
