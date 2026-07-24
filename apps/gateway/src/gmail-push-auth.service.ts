import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { env } from "@heyriz/shared/env";
import { safeEqual } from "./internal-auth";

export type PubSubPushEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
  };
  subscription?: string;
};

export type VerifiedGmailPush = {
  emailAddress: string;
  historyId: string;
  pubsubMessageId: string;
};

@Injectable()
export class GmailPushAuthService {
  private readonly verifier = new OAuth2Client();

  async verify(
    authorization: string | undefined,
    verificationToken: string | undefined,
    envelope: PubSubPushEnvelope,
  ): Promise<VerifiedGmailPush> {
    const audience = env.GMAIL_PUBSUB_AUDIENCE;
    const serviceAccount = env.GMAIL_PUBSUB_SERVICE_ACCOUNT;
    const expectedToken = env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
    if (!audience || !serviceAccount || !expectedToken) {
      throw new ServiceUnavailableException("gmail_push_not_configured");
    }
    if (!safeEqual(verificationToken, expectedToken)) {
      throw new UnauthorizedException("gmail_push_token_invalid");
    }

    const bearer = /^Bearer\s+(.+)$/i.exec(authorization ?? "")?.[1];
    if (!bearer) {
      throw new UnauthorizedException("gmail_push_bearer_required");
    }
    let payload;
    try {
      const ticket = await this.verifier.verifyIdToken({
        idToken: bearer,
        audience,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("gmail_push_identity_invalid");
    }
    if (
      !payload?.email ||
      payload.email_verified !== true ||
      payload.email.toLowerCase() !== serviceAccount.toLowerCase()
    ) {
      throw new UnauthorizedException("gmail_push_identity_invalid");
    }

    const encodedData = envelope.message?.data;
    const pubsubMessageId = envelope.message?.messageId?.trim();
    if (!encodedData || !pubsubMessageId) {
      throw new BadRequestException("gmail_push_envelope_invalid");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(
        Buffer.from(encodedData, "base64url").toString("utf8"),
      );
    } catch {
      throw new BadRequestException("gmail_push_payload_invalid");
    }
    if (!isGmailPushPayload(decoded)) {
      throw new BadRequestException("gmail_push_payload_invalid");
    }
    return {
      emailAddress: decoded.emailAddress.trim().toLowerCase(),
      historyId: decoded.historyId,
      pubsubMessageId: pubsubMessageId.slice(0, 200),
    };
  }
}

function isGmailPushPayload(
  value: unknown,
): value is { emailAddress: string; historyId: string } {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.emailAddress === "string" &&
    payload.emailAddress.length <= 320 &&
    /^[^@\s]+@[^@\s]+$/.test(payload.emailAddress.trim()) &&
    typeof payload.historyId === "string" &&
    /^\d+$/.test(payload.historyId)
  );
}
