import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@heyriz/shared/env";

type RazorpaySubscriptionResponse = {
  id: string;
  status: string;
  short_url?: string;
  current_start?: number;
  current_end?: number;
};

type RazorpayOrderResponse = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  receipt?: string;
};

type RazorpayPlanResponse = {
  id: string;
  period: string;
  interval: number;
  item: { name: string; amount: number; currency: string };
};

@Injectable()
export class RazorpayClient {
  configured() {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  }

  webhookConfigured() {
    return Boolean(env.RAZORPAY_WEBHOOK_SECRET);
  }

  async createSubscription(input: {
    planId: string;
    userId: string;
    localPlanId: string;
    trialEndsAt?: Date | null;
    email?: string;
    name?: string;
    returnUrl?: string;
  }): Promise<RazorpaySubscriptionResponse> {
    const body: Record<string, unknown> = {
      plan_id: input.planId,
      total_count: env.BILLING_SUBSCRIPTION_TOTAL_COUNT,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: input.userId,
        planId: input.localPlanId,
        email: input.email ?? "",
        name: input.name ?? "",
        returnUrl: input.returnUrl ?? "",
      },
    };

    if (input.trialEndsAt && input.trialEndsAt.getTime() > Date.now()) {
      body.start_at = Math.floor(input.trialEndsAt.getTime() / 1000);
    }

    return this.request<RazorpaySubscriptionResponse>("/v1/subscriptions", {
      method: "POST",
      body,
    });
  }

  async createPlan(input: {
    name: string;
    description?: string;
    amount: number;
    currency: string;
    period: "monthly" | "yearly";
  }): Promise<RazorpayPlanResponse> {
    return this.request<RazorpayPlanResponse>("/v1/plans", {
      method: "POST",
      body: {
        period: input.period,
        interval: 1,
        item: {
          name: input.name,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
        },
      },
    });
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>(
      `/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      { method: "GET" },
    );
  }

  async cancelSubscription(providerSubscriptionId: string) {
    return this.request<RazorpaySubscriptionResponse>(
      `/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`,
      {
        method: "POST",
        body: { cancel_at_cycle_end: 1 },
      },
    );
  }

  async createOrder(input: {
    userId: string;
    localPlanId: string;
    amount: number;
    currency: string;
    receipt: string;
    email?: string;
    name?: string;
  }): Promise<RazorpayOrderResponse> {
    return this.request<RazorpayOrderResponse>("/v1/orders", {
      method: "POST",
      body: {
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: {
          userId: input.userId,
          planId: input.localPlanId,
          email: input.email ?? "",
          name: input.name ?? "",
        },
      },
    });
  }

  verifyWebhook(rawBody: string, signature?: string) {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
    const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST"; body?: Record<string, unknown> },
  ): Promise<T> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error("razorpay_not_configured");
    }

    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString(
      "base64",
    );
    const res = await fetch(`https://api.razorpay.com${path}`, {
      method: options.method,
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      throw new Error(`razorpay_api_${res.status}:${details.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }
}
