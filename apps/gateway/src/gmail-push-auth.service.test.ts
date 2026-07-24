import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2Client } from "google-auth-library";

vi.mock("@heyriz/shared/env", () => ({
  env: {
    GMAIL_PUBSUB_AUDIENCE: "https://api.example.com/api/gmail/push",
    GMAIL_PUBSUB_SERVICE_ACCOUNT: "push@example.iam.gserviceaccount.com",
    GMAIL_PUBSUB_VERIFICATION_TOKEN: "a-production-length-verification-token",
  },
}));

import { GmailPushAuthService } from "./gmail-push-auth.service";

describe("GmailPushAuthService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({
      getPayload: () => ({
        email: "push@example.iam.gserviceaccount.com",
        email_verified: true,
      }),
    } as never);
  });

  it("verifies both Pub/Sub identity and the shared endpoint token", async () => {
    const service = new GmailPushAuthService();
    const data = Buffer.from(
      JSON.stringify({
        emailAddress: "Owner@Example.com",
        historyId: "12345",
      }),
    ).toString("base64url");

    await expect(
      service.verify(
        "Bearer signed-oidc-token",
        "a-production-length-verification-token",
        { message: { data, messageId: "pubsub-1" } },
      ),
    ).resolves.toEqual({
      emailAddress: "owner@example.com",
      historyId: "12345",
      pubsubMessageId: "pubsub-1",
    });
    expect(OAuth2Client.prototype.verifyIdToken).toHaveBeenCalledWith({
      idToken: "signed-oidc-token",
      audience: "https://api.example.com/api/gmail/push",
    });
  });

  it("rejects a request before JWT verification when the endpoint token is wrong", async () => {
    const service = new GmailPushAuthService();

    await expect(
      service.verify("Bearer forged", "wrong", { message: {} }),
    ).rejects.toMatchObject({ status: 401 });
    expect(OAuth2Client.prototype.verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects a valid JWT issued to the wrong service account", async () => {
    vi.mocked(OAuth2Client.prototype.verifyIdToken).mockResolvedValueOnce({
      getPayload: () => ({
        email: "attacker@example.iam.gserviceaccount.com",
        email_verified: true,
      }),
    } as never);
    const service = new GmailPushAuthService();

    await expect(
      service.verify(
        "Bearer signed-oidc-token",
        "a-production-length-verification-token",
        { message: {} },
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
