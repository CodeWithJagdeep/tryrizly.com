import { createHmac } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { safeEqual } from "./internal-auth";
import { NotionWebhookRepository } from "./notion-webhook.repository";

/**
 * Notion's webhook lifecycle has two phases, unlike Slack/Stripe-style
 * providers that auto-verify by echoing a challenge back:
 *
 *  1. Handshake — Notion POSTs a bare `{ verification_token }` once. There is
 *     no automatic response that satisfies Notion; the developer must copy
 *     the token out of server logs and paste it into the integration's
 *     dashboard "Verify" dialog by hand. We just persist it here so it's
 *     available for step 2, and log it clearly for that manual copy.
 *  2. Every event after that is signed: `X-Notion-Signature` is an
 *     HMAC-SHA256 of the raw request body, keyed by that same
 *     verification_token.
 */
@Injectable()
export class NotionWebhookAuthService {
  constructor(
    @Inject(NotionWebhookRepository)
    private readonly repo: NotionWebhookRepository,
  ) {}

  /** Returns the parsed event body once signature-verified, or undefined (handshake handled, or dropped as unverifiable). */
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

    const token = typeof body.verification_token === "string" ? body.verification_token : undefined;
    if (token) {
      await this.repo.setVerificationToken(token);
      logger.info(
        "notion webhook verification token received — paste this into the Notion integration's Verify dialog",
        { token },
      );
      return undefined;
    }

    const stored = await this.repo.getVerificationToken();
    if (!stored) {
      logger.warn("notion webhook event received before an endpoint has been verified; dropping");
      return undefined;
    }

    const expected = createHmac("sha256", stored).update(rawBody).digest("hex");
    const actual = (signatureHeader ?? "").replace(/^sha256=/, "");
    if (!safeEqual(actual, expected)) {
      logger.warn("notion webhook signature mismatch; dropping");
      return undefined;
    }
    return body;
  }
}
