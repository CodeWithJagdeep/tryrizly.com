import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { BillingRepository } from "./billing.repository";
import { billingPlans, findPlan } from "./plans";
import { RazorpayClient } from "./razorpay.client";
import type {
  BillingCancelInput,
  BillingCheckoutInput,
  BillingCustomerInput,
  BillingPlan,
  BillingPurchaseRecord,
  BillingSubscriptionRecord,
  BillingTrialInput,
  BillingTrialRecord,
  BillingWebhookInput,
} from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated"]);
const ACCESS_PURCHASE_STATUSES = new Set(["paid", "captured"]);

@Injectable()
export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly razorpay: RazorpayClient,
  ) {}

  healthCheck() {
    return {
      ok: true,
      service: "billing",
      framework: "nestjs",
      transport: {
        billing: "tcp",
        host: env.BILLING_TCP_HOST,
        port: env.BILLING_TCP_PORT,
      },
      databaseConfigured: this.repository.databaseConfigured(),
      razorpayConfigured: this.razorpay.configured(),
      webhookConfigured: this.razorpay.webhookConfigured(),
    };
  }

  plans() {
    return {
      ok: true,
      plans: billingPlans().map((plan) => this.publicPlan(plan)),
      provider: "razorpay",
    };
  }

  async status(input: BillingCustomerInput) {
    const userId = this.requireUserId(input.userId);
    const [trial, subscription, purchase] = await Promise.all([
      this.repository.findTrial(userId),
      this.repository.findCurrentSubscription(userId),
      this.repository.findCurrentPurchase(userId),
    ]);

    const resolved = this.resolveAccess(trial, subscription, purchase);
    return {
      ok: true,
      userId,
      plan: this.publicPlan(resolved.plan),
      access: resolved.access,
      trial: trial ? this.publicTrial(trial) : null,
      subscription: subscription ? this.publicSubscription(subscription) : null,
      purchase: purchase ? this.publicPurchase(purchase) : null,
    };
  }

  async startTrial(input: BillingTrialInput) {
    const userId = this.requireUserId(input.userId);
    // Free is the post-trial floor, not something to trial into — default the
    // trial itself to "business" so it actually shows full features before
    // asking the principal to convert.
    const plan = this.requirePlan(input.planId ?? "business");
    if (plan.kind !== "subscription") {
      return { ok: false, error: "trial_requires_subscription_plan" };
    }

    await this.repository.upsertCustomer(input);
    const existingTrial = await this.repository.findTrial(userId);
    if (existingTrial) {
      return {
        ok: true,
        alreadyStarted: true,
        trial: this.publicTrial(existingTrial),
        status: await this.status({ userId }),
      };
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
    const trial = await this.repository.createTrial({
      userId,
      planId: plan.id,
      startedAt,
      endsAt,
    });

    await this.repository.createSubscription({
      userId,
      planId: plan.id,
      provider: "internal",
      status: "trialing",
      trialEndsAt: endsAt,
      metadata: { source: "local_trial" },
    });

    return {
      ok: true,
      trial: this.publicTrial(trial),
      status: await this.status({ userId }),
    };
  }

  async createSubscriptionCheckout(input: BillingCheckoutInput) {
    const userId = this.requireUserId(input.userId);
    const plan = this.requirePlan(input.planId);
    if (plan.kind !== "subscription") {
      return { ok: false, error: "subscription_plan_required" };
    }
    if (!this.razorpay.configured()) {
      return { ok: false, error: "razorpay_not_configured" };
    }

    const razorpayPlanId = await this.ensureRazorpayPlanId(plan);

    await this.repository.upsertCustomer(input);
    const trial = await this.repository.findTrial(userId);
    const trialEndsAt =
      trial && trial.ends_at.getTime() > Date.now() ? trial.ends_at : null;

    const providerSubscription = await this.razorpay.createSubscription({
      planId: razorpayPlanId,
      localPlanId: plan.id,
      userId,
      email: input.email,
      name: input.name,
      returnUrl: input.returnUrl,
      trialEndsAt,
    });

    const subscription = await this.repository.createSubscription({
      userId,
      planId: plan.id,
      provider: "razorpay",
      providerSubscriptionId: providerSubscription.id,
      status: providerSubscription.status,
      currentPeriodEnd: this.secondsToDate(providerSubscription.current_end),
      trialEndsAt,
      metadata: {
        checkoutUrl: providerSubscription.short_url ?? null,
        providerStatus: providerSubscription.status,
      },
    });

    return {
      ok: true,
      provider: "razorpay",
      checkoutUrl: providerSubscription.short_url ?? null,
      providerSubscriptionId: providerSubscription.id,
      subscription: this.publicSubscription(subscription),
    };
  }

  async createPurchaseCheckout(input: BillingCheckoutInput) {
    const userId = this.requireUserId(input.userId);
    const plan = this.requirePlan(input.planId);
    if (plan.kind !== "one_time") {
      return { ok: false, error: "one_time_plan_required" };
    }
    if (!this.razorpay.configured()) {
      return { ok: false, error: "razorpay_not_configured" };
    }

    await this.repository.upsertCustomer(input);
    const receipt = `hrz_${randomUUID().replace(/-/g, "").slice(0, 28)}`;
    const order = await this.razorpay.createOrder({
      userId,
      localPlanId: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      receipt,
      email: input.email,
      name: input.name,
    });

    const purchase = await this.repository.createPurchase({
      userId,
      planId: plan.id,
      provider: "razorpay",
      providerOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      metadata: { receipt: order.receipt ?? receipt },
    });

    return {
      ok: true,
      provider: "razorpay",
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      purchase: this.publicPurchase(purchase),
    };
  }

  async cancelSubscription(input: BillingCancelInput) {
    const userId = this.requireUserId(input.userId);
    const current =
      input.providerSubscriptionId
        ? await this.repository.findSubscriptionByProviderId(input.providerSubscriptionId)
        : input.subscriptionId
          ? await this.repository.findSubscriptionById(input.subscriptionId, userId)
        : await this.repository.findCurrentSubscription(userId);
    if (!current || current.user_id !== userId) {
      return { ok: false, error: "subscription_not_found", subscription: null };
    }

    const providerSubscriptionId = current.provider_subscription_id ?? undefined;

    if (providerSubscriptionId && current.provider === "razorpay") {
      await this.razorpay.cancelSubscription(providerSubscriptionId);
    }

    const cancelled = await this.repository.cancelSubscription({
      userId,
      id: input.subscriptionId,
      providerSubscriptionId,
    });

    return {
      ok: Boolean(cancelled),
      subscription: cancelled ? this.publicSubscription(cancelled) : null,
    };
  }

  async handleRazorpayWebhook(input: BillingWebhookInput) {
    if (!this.razorpay.verifyWebhook(input.rawBody, input.signature)) {
      return { ok: false, error: "invalid_signature" };
    }

    const eventType = String(input.payload.event ?? "unknown");
    const entityId = this.extractRazorpayEntityId(input.payload);
    const eventId = input.eventId || (entityId ? `${eventType}:${entityId}` : randomUUID());
    const inserted = await this.repository.insertEvent({
      provider: "razorpay",
      eventId,
      eventType,
      payload: input.payload,
    });
    if (!inserted) return { ok: true, duplicate: true };

    if (eventType.startsWith("subscription.")) {
      await this.applySubscriptionEvent(eventType, input.payload);
    } else if (
      eventType === "order.paid" ||
      eventType === "payment.captured" ||
      eventType === "payment.authorized" ||
      eventType === "payment.failed"
    ) {
      await this.applyPurchaseEvent(eventType, input.payload);
    } else {
      logger.info("billing webhook ignored", { provider: "razorpay", eventType });
    }

    return { ok: true };
  }

  private async applySubscriptionEvent(eventType: string, payload: Record<string, unknown>) {
    const entity = this.extractEntity(payload, "subscription");
    const providerSubscriptionId = stringValue(entity.id);
    if (!providerSubscriptionId) return;

    const notes = asRecord(entity.notes);
    const userId = stringValue(notes.userId);
    const planId = stringValue(notes.planId);
    const status = stringValue(entity.status) || eventType.replace("subscription.", "");

    await this.repository.updateSubscriptionByProvider({
      providerSubscriptionId,
      userId,
      planId,
      provider: "razorpay",
      status,
      currentPeriodEnd: this.secondsToDate(numberValue(entity.current_end)),
      cancelAtPeriodEnd: status === "cancelled" || status === "completed",
      metadata: {
        eventType,
        providerStatus: status,
      },
    });
  }

  private async applyPurchaseEvent(eventType: string, payload: Record<string, unknown>) {
    const payment = this.extractEntity(payload, "payment");
    const order = this.extractEntity(payload, "order");
    const providerOrderId = stringValue(payment.order_id) || stringValue(order.id);
    if (!providerOrderId) return;

    const paymentNotes = asRecord(payment.notes);
    const orderNotes = asRecord(order.notes);
    const notes = Object.keys(paymentNotes).length ? paymentNotes : orderNotes;
    const status =
      eventType === "payment.failed"
        ? "failed"
        : eventType === "payment.authorized"
          ? "authorized"
          : "paid";

    await this.repository.updatePurchaseByProviderOrder({
      providerOrderId,
      userId: stringValue(notes.userId),
      planId: stringValue(notes.planId),
      provider: "razorpay",
      amount: numberValue(payment.amount) ?? numberValue(order.amount),
      currency: stringValue(payment.currency) || stringValue(order.currency),
      status,
      metadata: {
        eventType,
        paymentId: stringValue(payment.id),
      },
    });
  }

  private resolveAccess(
    trial: BillingTrialRecord | null,
    subscription: BillingSubscriptionRecord | null,
    purchase: BillingPurchaseRecord | null,
  ) {
    const now = Date.now();
    const trialActive = trial && !trial.consumed && trial.ends_at.getTime() > now;
    const subscriptionActive =
      subscription &&
      (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) ||
        (subscription.status === "trialing" &&
          subscription.trial_ends_at &&
          subscription.trial_ends_at.getTime() > now));
    const purchaseActive = purchase && ACCESS_PURCHASE_STATUSES.has(purchase.status);

    if (subscriptionActive && subscription) {
      const plan = findPlan(subscription.plan_id) ?? this.freePlan();
      return {
        plan,
        access: {
          active: true,
          state: subscription.status,
          expiresAt: (subscription.current_period_end ?? subscription.trial_ends_at)?.toISOString() ?? null,
        },
      };
    }

    if (trialActive && trial) {
      const plan = findPlan(trial.plan_id) ?? this.freePlan();
      return {
        plan,
        access: {
          active: true,
          state: "trialing",
          expiresAt: trial.ends_at.toISOString(),
        },
      };
    }

    if (purchaseActive && purchase) {
      const plan = findPlan(purchase.plan_id) ?? this.freePlan();
      return {
        plan,
        access: {
          active: true,
          state: "purchased",
          expiresAt: null,
        },
      };
    }

    return {
      plan: this.freePlan(),
      access: {
        active: true,
        state: "free",
        expiresAt: null,
      },
    };
  }

  private requireUserId(userId?: string) {
    const normalized = userId?.trim().toLowerCase();
    if (!normalized) throw new Error("user_id_required");
    return normalized;
  }

  private requirePlan(planId: string) {
    const plan = findPlan(planId);
    if (!plan) throw new Error("unknown_plan");
    return plan;
  }

  private freePlan() {
    return this.requirePlan("free");
  }

  private async ensureRazorpayPlanId(plan: BillingPlan): Promise<string> {
    if (plan.razorpayPlanId) return plan.razorpayPlanId;

    const cached = await this.repository.findProviderPlanId("razorpay", plan.id);
    if (cached) return cached;

    const created = await this.razorpay.createPlan({
      name: plan.name,
      description: plan.description,
      amount: plan.amount,
      currency: plan.currency,
      period: plan.interval === "year" ? "yearly" : "monthly",
    });
    await this.repository.saveProviderPlanId("razorpay", plan.id, created.id);
    return created.id;
  }

  private publicPlan(plan: BillingPlan) {
    return {
      ...plan,
      razorpayPlanId: undefined,
      configured: plan.kind !== "subscription" || this.razorpay.configured(),
    };
  }

  private publicTrial(trial: BillingTrialRecord) {
    return {
      planId: trial.plan_id,
      startedAt: trial.started_at.toISOString(),
      endsAt: trial.ends_at.toISOString(),
      consumed: trial.consumed,
      active: !trial.consumed && trial.ends_at.getTime() > Date.now(),
    };
  }

  private publicSubscription(subscription: BillingSubscriptionRecord) {
    return {
      id: subscription.id,
      planId: subscription.plan_id,
      provider: subscription.provider,
      providerSubscriptionId: subscription.provider_subscription_id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end?.toISOString() ?? null,
      trialEndsAt: subscription.trial_ends_at?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: subscription.created_at.toISOString(),
      updatedAt: subscription.updated_at.toISOString(),
    };
  }

  private publicPurchase(purchase: BillingPurchaseRecord) {
    return {
      id: purchase.id,
      planId: purchase.plan_id,
      provider: purchase.provider,
      providerOrderId: purchase.provider_order_id,
      amount: purchase.amount,
      currency: purchase.currency,
      status: purchase.status,
      createdAt: purchase.created_at.toISOString(),
      updatedAt: purchase.updated_at.toISOString(),
    };
  }

  private secondsToDate(seconds?: number | null) {
    return seconds ? new Date(seconds * 1000) : null;
  }

  private extractRazorpayEntityId(payload: Record<string, unknown>) {
    return (
      stringValue(this.extractEntity(payload, "subscription").id) ||
      stringValue(this.extractEntity(payload, "payment").id) ||
      stringValue(this.extractEntity(payload, "order").id)
    );
  }

  private extractEntity(payload: Record<string, unknown>, key: string) {
    return asRecord(asRecord(asRecord(payload.payload)?.[key])?.entity);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
