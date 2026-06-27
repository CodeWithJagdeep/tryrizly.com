import { Injectable } from "@nestjs/common";
import type { RazorpayConnectorSecret } from "./connector.types";

const RAZORPAY_ENDPOINTS = {
  payments: "/v1/payments",
  orders: "/v1/orders",
  settlements: "/v1/settlements",
  refunds: "/v1/refunds",
} as const;

export type RazorpayEndpoint = keyof typeof RAZORPAY_ENDPOINTS;

export type RazorpayQuery = {
  count?: number;
  skip?: number;
  from?: number;
  to?: number;
};

/**
 * Read-only Razorpay access. The caller (text-to-query / business_snapshot)
 * only ever picks one of these four enum keys plus pagination/date params —
 * there is no way to construct an arbitrary URL, so there is no reachable
 * path to a write endpoint (capture, refund, payout) by construction.
 */
@Injectable()
export class RazorpayService {
  async fetch(
    secret: RazorpayConnectorSecret,
    endpoint: RazorpayEndpoint,
    query: RazorpayQuery = {},
  ): Promise<{ items: unknown[] }> {
    const params = new URLSearchParams();
    if (query.count) params.set("count", String(Math.min(query.count, 100)));
    if (query.skip) params.set("skip", String(query.skip));
    if (query.from) params.set("from", String(query.from));
    if (query.to) params.set("to", String(query.to));

    const auth = Buffer.from(`${secret.keyId}:${secret.keySecret}`).toString("base64");
    const res = await fetch(`https://api.razorpay.com${RAZORPAY_ENDPOINTS[endpoint]}?${params.toString()}`, {
      headers: { authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      throw new Error(`razorpay_api_${res.status}`);
    }

    const data = (await res.json()) as { items?: unknown[] };
    return { items: data.items ?? [] };
  }
}
