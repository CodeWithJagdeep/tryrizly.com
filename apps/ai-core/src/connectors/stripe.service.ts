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

  /** The automation "Create Customer" action — the one write path this service exposes. */
  async createCustomer(
    secret: StripeConnectorSecret,
    input: { email?: string; name?: string },
  ): Promise<{ id: string }> {
    const params = new URLSearchParams();
    if (input.email) params.set("email", input.email);
    if (input.name) params.set("name", input.name);

    const res = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret.secretKey}`,
        "Stripe-Version": "2024-06-20",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`stripe_api_${res.status}`);
    const data = (await res.json()) as { id: string };
    return { id: data.id };
  }
}
