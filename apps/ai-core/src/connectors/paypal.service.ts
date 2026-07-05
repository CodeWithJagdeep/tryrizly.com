import { Injectable } from "@nestjs/common";
import type { PayPalConnectorSecret } from "./connector.types";

const PAYPAL_API = "https://api-m.paypal.com";

export type PayPalTransaction = {
  transaction_info?: {
    transaction_id?: string;
    transaction_amount?: { currency_code?: string; value?: string };
    transaction_status?: string;
    transaction_initiation_date?: string;
    transaction_subject?: string;
  };
  payer_info?: { email_address?: string; payer_name?: { alternate_full_name?: string } };
};

export type PayPalBalance = {
  currency?: string;
  total_balance?: { currency_code?: string; value?: string };
  available_balance?: { currency_code?: string; value?: string };
};

/**
 * Read-only PayPal access. Only the two reporting endpoints below are
 * reachable — no way to construct an arbitrary URL, so no path to a write
 * endpoint (payouts, refunds, captures) by construction. Requires the
 * "Transaction Search" product enabled on the user's REST app; a 403 is
 * surfaced as paypal_reporting_not_enabled so the tool can explain that.
 */
@Injectable()
export class PayPalService {
  private async getAccessToken(secret: PayPalConnectorSecret): Promise<string> {
    const auth = Buffer.from(`${secret.clientId}:${secret.clientSecret}`).toString("base64");
    const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? "paypal_invalid_credentials" : `paypal_auth_${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("paypal_auth_no_token");
    return data.access_token;
  }

  private async get<T>(secret: PayPalConnectorSecret, path: string): Promise<T> {
    const token = await this.getAccessToken(secret);
    const res = await fetch(`${PAYPAL_API}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 403) throw new Error("paypal_reporting_not_enabled");
    if (!res.ok) throw new Error(`paypal_api_${res.status}`);
    return (await res.json()) as T;
  }

  /** Balances across currencies. */
  getBalances(secret: PayPalConnectorSecret): Promise<{ balances?: PayPalBalance[] }> {
    return this.get(secret, "/v1/reporting/balances");
  }

  /** Transactions in [start, end]; PayPal caps a single query at 31 days. */
  getTransactions(
    secret: PayPalConnectorSecret,
    startDate: Date,
    endDate: Date,
  ): Promise<{ transaction_details?: PayPalTransaction[] }> {
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      page_size: "100",
      fields: "transaction_info,payer_info",
    });
    return this.get(secret, `/v1/reporting/transactions?${params.toString()}`);
  }
}
