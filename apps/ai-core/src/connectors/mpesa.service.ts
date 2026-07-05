import { Injectable } from "@nestjs/common";
import type { MpesaConnectorSecret } from "./connector.types";

const MPESA_HOSTS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

/**
 * M-Pesa (Safaricom Daraja) access. Daraja's data APIs (Account Balance,
 * Transaction Status) are asynchronous — results arrive on a registered
 * callback URL, not in the HTTP response — so until that callback endpoint
 * exists, this service only verifies credentials via the synchronous OAuth
 * token endpoint. Keys are still captured and vaulted now so the connector
 * lights up the moment the callback flow ships.
 */
@Injectable()
export class MpesaService {
  async verifyCredentials(secret: MpesaConnectorSecret): Promise<{ ok: true; expiresInSeconds: number }> {
    const host = MPESA_HOSTS[secret.environment] ?? MPESA_HOSTS.production;
    const auth = Buffer.from(`${secret.consumerKey}:${secret.consumerSecret}`).toString("base64");
    const res = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      throw new Error(res.status === 400 || res.status === 401 ? "mpesa_invalid_credentials" : `mpesa_api_${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: string };
    if (!data.access_token) throw new Error("mpesa_auth_no_token");
    return { ok: true, expiresInSeconds: Number(data.expires_in ?? 3599) };
  }
}
