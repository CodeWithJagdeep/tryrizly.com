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
 * Mostly read-only Razorpay access. The caller (text-to-query /
 * business_snapshot) only ever picks one of these four enum keys plus
 * pagination/date params — there is no way to construct an arbitrary URL
 * for `fetch`, so there is no reachable path to a write endpoint (capture,
 * refund, payout) through it. `createInvoice` below is the one deliberate
 * write path, backing the automation "Create Invoice" action.
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

  /** The automation "Create Invoice" action — the one write path this service exposes. */
  async createInvoice(
    secret: RazorpayConnectorSecret,
    input: { email?: string; amount: number; currency?: string; description?: string },
  ): Promise<{ id: string; short_url?: string }> {
    const auth = Buffer.from(`${secret.keyId}:${secret.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/invoices", {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({
        type: "invoice",
        customer: input.email ? { email: input.email } : undefined,
        line_items: [
          {
            name: input.description || "Invoice",
            // Razorpay amounts are always in the smallest currency unit (paise for INR).
            amount: Math.round(input.amount * 100),
            currency: input.currency || "INR",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`razorpay_api_${res.status}`);
    const data = (await res.json()) as { id: string; short_url?: string };
    return { id: data.id, short_url: data.short_url };
  }
}
