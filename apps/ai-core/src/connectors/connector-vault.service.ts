import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import type { ConnectorSecretPayload } from "./connector.types";

@Injectable()
export class ConnectorVaultService {
  encrypt(payload: ConnectorSecretPayload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.getKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      "v1",
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): ConnectorSecretPayload {
    const [version, iv, tag, ciphertext] = value.split(".");

    if (version !== "v1" || !iv || !tag || !ciphertext) {
      throw new Error("Invalid encrypted connector payload");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.getKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString("utf8")) as ConnectorSecretPayload;
  }

  private getKey() {
    const configuredKey = env.CONNECTOR_VAULT_KEY;

    if (!configuredKey && env.NODE_ENV === "production") {
      throw new Error("CONNECTOR_VAULT_KEY is required in production");
    }

    return createHash("sha256")
      .update(configuredKey || "heyriz-local-dev-connector-vault-key")
      .digest();
  }
}
