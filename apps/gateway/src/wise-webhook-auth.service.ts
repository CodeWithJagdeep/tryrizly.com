import { createVerify } from "crypto";
import { Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";

const WISE_PUBLIC_KEY_URL = "https://api.wise.com/v1/webhooks-public-key.pem";

/**
 * Wise signs webhooks with an RSA keypair, not HMAC — every other webhook in
 * this codebase is HMAC-keyed by a shared secret. Verification instead fetches
 * Wise's own public key once and checks X-Signature-SHA256 against it with
 * Node's RSA-SHA256 verify. The key is effectively static, so it's cached in
 * memory for the process lifetime rather than refetched per request.
 */
@Injectable()
export class WiseWebhookAuthService {
  private cachedPublicKey: string | undefined;

  async verify(rawBody: Buffer, signatureHeader: string | undefined): Promise<boolean> {
    if (!signatureHeader) {
      logger.warn("wise webhook: missing X-Signature-SHA256 header; dropping");
      return false;
    }
    const publicKey = await this.getPublicKey();
    if (!publicKey) {
      logger.warn("wise webhook: couldn't fetch Wise's public key; dropping");
      return false;
    }
    try {
      const verifier = createVerify("RSA-SHA256");
      verifier.update(rawBody);
      verifier.end();
      return verifier.verify(publicKey, signatureHeader, "base64");
    } catch (error) {
      logger.warn("wise webhook signature verification threw; dropping", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async getPublicKey(): Promise<string | undefined> {
    if (this.cachedPublicKey) return this.cachedPublicKey;
    try {
      const response = await fetch(WISE_PUBLIC_KEY_URL);
      if (!response.ok) return undefined;
      this.cachedPublicKey = await response.text();
      return this.cachedPublicKey;
    } catch {
      return undefined;
    }
  }
}
