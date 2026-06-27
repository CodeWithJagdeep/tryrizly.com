import { Injectable } from "@nestjs/common";
import type { StripeConnectorSecret } from "./connector.types";

const STRIPE_ENDPOINTS = {
  charges: "/v1/charges",
  payment_intents: "/v1/payment_intents",
  customers: "/v1/customers",
  subscriptions: "/v1/subscriptions",
  invoices: "/v1/invoices",
  balance_transactions: "/v1/balance_transactions",
} as const;

export type StripeEndpoint = keyof typeof STRIPE_ENDPOINTS;

export type StripeQuery = {
  limit?: number;
  created_gte?: number;
  created_lte?: number;
};

@Injectable()
export class StripeService {
  async fetch(
    secret: StripeConnectorSecret,
    endpoint: StripeEndpoint,
    query: StripeQuery = {},
  ): Promise<{ data: unknown[] }> {
    const params = new URLSearchParams();
    if (query.limit) params.set("limit", String(Math.min(query.limit, 100)));
    if (query.created_gte) params.set("created[gte]", String(query.created_gte));
    if (query.created_lte) params.set("created[lte]", String(query.created_lte));

    const res = await fetch(
      `https://api.stripe.com${STRIPE_ENDPOINTS[endpoint]}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${secret.secretKey}`,
          "Stripe-Version": "2024-06-20",
        },
      },
    );

    if (!res.ok) {
      throw new Error(`stripe_api_${res.status}`);
    }

    const data = (await res.json()) as { data?: unknown[] };
    return { data: data.data ?? [] };
  }
}
