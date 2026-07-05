import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { sendEmail } from "@heyriz/shared/email";
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
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["cancelled", "completed", "expired", "halted"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A Telegram nudge the sweep wants delivered; the worker owns the queue, so these are returned, not enqueued here. */
export type SweepNudge = {
  userId: string;
  kind: "trial-d3" | "trial-d1" | "trial-ended" | "renewal-notice";
  message: string;
  emailFallback: boolean;
};

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

    if (input.email) {
      sendTrialStartedEmail(input.email, input.name, plan.name, endsAt).catch((error) => {
        logger.warn("failed to send trial started email", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

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

    if (cancelled) {
      this.notifyCustomer(userId, input.email, input.name, (email, name) =>
        sendSubscriptionCancelledEmail(email, name, current.current_period_end ?? undefined),
      );
    }

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
    const isTerminal = status === "cancelled" || status === "completed";

    const previous = await this.repository.findSubscriptionByProviderId(providerSubscriptionId);
    const wasAlreadyTerminal = previous?.status === "cancelled" || previous?.status === "completed";

    await this.repository.updateSubscriptionByProvider({
      providerSubscriptionId,
      userId,
      planId,
      provider: "razorpay",
      status,
      currentPeriodEnd: this.secondsToDate(numberValue(entity.current_end)),
      cancelAtPeriodEnd: isTerminal,
      metadata: {
        eventType,
        providerStatus: status,
      },
    });

    // Only notify on the transition into cancelled/completed — avoids a double
    // send when this webhook follows our own cancelSubscription() call, which
    // already emailed the customer directly.
    if (userId && isTerminal && !wasAlreadyTerminal) {
      this.notifyCustomer(userId, undefined, undefined, (email, name) =>
        sendSubscriptionCancelledEmail(email, name, this.secondsToDate(numberValue(entity.current_end)) ?? undefined),
      );
    }
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

    const userId = stringValue(notes.userId);
    const amount = numberValue(payment.amount) ?? numberValue(order.amount);
    const currency = stringValue(payment.currency) || stringValue(order.currency);

    await this.repository.updatePurchaseByProviderOrder({
      providerOrderId,
      userId,
      planId: stringValue(notes.planId),
      provider: "razorpay",
      amount,
      currency,
      status,
      metadata: {
        eventType,
        paymentId: stringValue(payment.id),
      },
    });

    if (userId && eventType === "payment.failed") {
      this.notifyCustomer(userId, undefined, undefined, sendPaymentFailedEmail);
    } else if (userId && eventType === "payment.captured") {
      // Razorpay fires both payment.captured and order.paid for a single purchase;
      // only capture the receipt on one of them to avoid sending it twice.
      this.notifyCustomer(userId, undefined, undefined, (email, name) =>
        sendPaymentReceiptEmail(email, name, amount, currency),
      );
    }
  }

  /**
   * Daily billing sweep, called by the worker's scheduler. Three jobs:
   * trial-expiry nudges (3-day and 1-day, deduped through billing_events so a
   * missed cron day can't skip a user), day-of-expiry processing (mark the
   * trial consumed + "trial ended" email), and reconciliation of provider
   * subscriptions whose paid period lapsed without a webhook. Telegram nudges
   * are returned to the caller — the worker owns the notification queue.
   */
  async runBillingSweep() {
    const nudges: SweepNudge[] = [];
    const upgradeUrl = `${env.WEB_APP_URL}/dashboard/upgrade`;

    let ending: BillingTrialRecord[] = [];
    let expired: BillingTrialRecord[] = [];
    try {
      [ending, expired] = await Promise.all([
        this.repository.findTrialsEndingWithin(3),
        this.repository.findExpiredUnconsumedTrials(),
      ]);
    } catch (error) {
      logger.warn("billing sweep: trial lookup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    for (const trial of ending) {
      try {
        if (await this.hasPaidAccess(trial.user_id)) continue;
        const daysLeft = Math.ceil((trial.ends_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        const kind = daysLeft <= 1 ? "trial-d1" : "trial-d3";
        const firstTime = await this.repository.insertEvent({
          provider: "internal",
          eventId: `trial-nudge:${trial.user_id}:${kind}`,
          eventType: "trial_nudge",
          payload: { daysLeft },
        });
        if (!firstTime) continue;
        nudges.push({
          userId: trial.user_id,
          kind,
          message:
            kind === "trial-d1"
              ? `⏰ Your Rizly free trial ends tomorrow. Subscribe now to keep access: ${upgradeUrl}`
              : `⏰ Your Rizly free trial ends in ${daysLeft} days. Subscribe to keep your reminders, email triage, and morning briefs: ${upgradeUrl}`,
          emailFallback: true,
        });
      } catch (error) {
        logger.warn("billing sweep: trial nudge failed", {
          userId: trial.user_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Renewal notices: 5 days before the next auto-charge on an active paid
    // subscription, so nobody is surprised by a deduction. Deduped per billing
    // period through billing_events (keyed on the period end date), and only
    // for subscriptions not already set to stop at period end.
    try {
      const renewing = await this.repository.findSubscriptionsRenewingWithin(5);
      for (const subscription of renewing) {
        const periodEnd = subscription.current_period_end;
        if (!periodEnd) continue;
        const firstTime = await this.repository.insertEvent({
          provider: "internal",
          eventId: `renewal-notice:${subscription.user_id}:${periodEnd.toISOString().slice(0, 10)}`,
          eventType: "renewal_notice",
          payload: { subscriptionId: subscription.id, periodEnd: periodEnd.toISOString() },
        });
        if (!firstTime) continue;
        const plan = findPlan(subscription.plan_id);
        const amount = plan ? `${(plan.amount / 100).toFixed(0)} ${plan.currency}` : "your plan amount";
        const renewDate = periodEnd.toISOString().slice(0, 10);
        nudges.push({
          userId: subscription.user_id,
          kind: "renewal-notice",
          message: `Your Rizly ${plan?.name ?? subscription.plan_id} plan renews on ${renewDate} — ${amount} will be charged automatically. To stop the renewal, cancel any time before then: ${env.WEB_APP_URL}/dashboard/upgrade`,
          emailFallback: true,
        });
      }
    } catch (error) {
      logger.warn("billing sweep: renewal notice pass failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let expiredProcessed = 0;
    for (const trial of expired) {
      try {
        await this.repository.markTrialConsumed(trial.user_id);
        expiredProcessed += 1;
        if (await this.hasPaidAccess(trial.user_id)) continue;

        const customer = await this.repository.findCustomer(trial.user_id);
        const email =
          customer?.email ?? (EMAIL_RE.test(trial.user_id) ? trial.user_id : undefined);
        if (email) {
          sendTrialEndedEmail(email, customer?.name ?? undefined, upgradeUrl).catch((error) => {
            logger.warn("failed to send trial ended email", {
              userId: trial.user_id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
        nudges.push({
          userId: trial.user_id,
          kind: "trial-ended",
          message: `Your Rizly trial has ended — you're on the Free plan now. Reactivate reminders, email triage, and morning briefs: ${upgradeUrl}`,
          // The email above already covers unlinked users; don't email twice.
          emailFallback: false,
        });
      } catch (error) {
        logger.warn("billing sweep: trial expiry processing failed", {
          userId: trial.user_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const reconciled = await this.reconcileLapsedSubscriptions();

    return { ok: true, nudges, expiredProcessed, reconciled };
  }

  /**
   * Access rests on Razorpay webhooks; a missed one leaves a lapsed
   * subscription "active" locally forever. Re-poll anything whose paid period
   * ended over a day ago and adopt the provider's real status.
   */
  private async reconcileLapsedSubscriptions(): Promise<number> {
    if (!this.razorpay.configured()) return 0;

    let lapsed: BillingSubscriptionRecord[] = [];
    try {
      lapsed = await this.repository.findLapsedProviderSubscriptions();
    } catch (error) {
      logger.warn("billing sweep: lapsed subscription lookup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }

    let reconciled = 0;
    for (const subscription of lapsed) {
      const providerSubscriptionId = subscription.provider_subscription_id;
      if (!providerSubscriptionId) continue;
      try {
        const remote = await this.razorpay.fetchSubscription(providerSubscriptionId);
        if (remote.status === subscription.status && !remote.current_end) continue;

        await this.repository.updateSubscriptionByProvider({
          providerSubscriptionId,
          status: remote.status,
          currentPeriodEnd: this.secondsToDate(remote.current_end),
          cancelAtPeriodEnd: TERMINAL_SUBSCRIPTION_STATUSES.has(remote.status) || undefined,
          metadata: { reconciledAt: new Date().toISOString(), providerStatus: remote.status },
        });
        reconciled += 1;

        if (
          TERMINAL_SUBSCRIPTION_STATUSES.has(remote.status) &&
          !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)
        ) {
          this.notifyCustomer(subscription.user_id, undefined, undefined, (email, name) =>
            sendSubscriptionCancelledEmail(email, name, this.secondsToDate(remote.current_end) ?? undefined),
          );
        }
        logger.info("billing sweep: subscription reconciled", {
          userId: subscription.user_id,
          providerSubscriptionId,
          from: subscription.status,
          to: remote.status,
        });
      } catch (error) {
        logger.warn("billing sweep: subscription reconciliation failed", {
          providerSubscriptionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return reconciled;
  }

  private async hasPaidAccess(userId: string): Promise<boolean> {
    const [subscription, purchase] = await Promise.all([
      this.repository.findCurrentSubscription(userId),
      this.repository.findCurrentPurchase(userId),
    ]);
    return Boolean(
      (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) ||
        (purchase && ACCESS_PURCHASE_STATUSES.has(purchase.status)),
    );
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

  /** Resolves the customer's email (falling back to the stored record) and fires the given email, best-effort. */
  private notifyCustomer(
    userId: string,
    email: string | undefined,
    name: string | undefined,
    send: (email: string, name: string | undefined) => Promise<void>,
  ) {
    void (async () => {
      try {
        const customer = email ? null : await this.repository.findCustomer(userId);
        const resolvedEmail = email ?? customer?.email ?? undefined;
        const resolvedName = name ?? customer?.name ?? undefined;
        if (!resolvedEmail) return;
        await send(resolvedEmail, resolvedName);
      } catch (error) {
        logger.warn("failed to send billing notification email", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
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

function greet(name: string | undefined) {
  return name ? `Hi ${name}` : "Hi there";
}

async function sendTrialStartedEmail(
  email: string,
  name: string | undefined,
  planName: string,
  endsAt: Date,
): Promise<void> {
  const endsAtLabel = endsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  await sendEmail({
    to: email,
    subject: `Your ${planName} trial has started`,
    text: `${greet(name)},\n\nYour ${planName} trial is live and runs through ${endsAtLabel}. Every feature is unlocked — connect your accounts and Riz will start triaging right away.\n\n— The Rizly team`,
    html: `<p>${greet(name)},</p><p>Your <strong>${planName}</strong> trial is live and runs through <strong>${endsAtLabel}</strong>. Every feature is unlocked — connect your accounts and Riz will start triaging right away.</p><p>— The Rizly team</p>`,
  });
}

async function sendTrialEndedEmail(
  email: string,
  name: string | undefined,
  upgradeUrl: string,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Rizly trial has ended",
    text: `${greet(name)},\n\nYour free trial ended today, so your account is now on the Free plan. Reminders, email triage, and morning briefs are paused until you pick a plan.\n\nReactivate everything here: ${upgradeUrl}\n\n— The Rizly team`,
    html: `<p>${greet(name)},</p><p>Your free trial ended today, so your account is now on the <strong>Free</strong> plan. Reminders, email triage, and morning briefs are paused until you pick a plan.</p><p><a href="${upgradeUrl}">Reactivate everything</a></p><p>— The Rizly team</p>`,
  });
}

async function sendSubscriptionCancelledEmail(
  email: string,
  name: string | undefined,
  accessUntil: Date | undefined,
): Promise<void> {
  const untilLabel = accessUntil
    ? accessUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : undefined;
  await sendEmail({
    to: email,
    subject: "Your Rizly subscription has been cancelled",
    text: `${greet(name)},\n\nYour subscription has been cancelled.${untilLabel ? ` You'll keep access until ${untilLabel}.` : ""} If this was a mistake, you can resubscribe anytime from your dashboard.\n\n— The Rizly team`,
    html: `<p>${greet(name)},</p><p>Your subscription has been cancelled.${untilLabel ? ` You'll keep access until <strong>${untilLabel}</strong>.` : ""} If this was a mistake, you can resubscribe anytime from your dashboard.</p><p>— The Rizly team</p>`,
  });
}

async function sendPaymentFailedEmail(email: string, name: string | undefined): Promise<void> {
  await sendEmail({
    to: email,
    subject: "We couldn't process your payment",
    text: `${greet(name)},\n\nYour recent payment to Rizly didn't go through. Please update your payment method to keep your subscription active.\n\n— The Rizly team`,
    html: `<p>${greet(name)},</p><p>Your recent payment to Rizly didn't go through. Please update your payment method to keep your subscription active.</p><p>— The Rizly team</p>`,
  });
}

async function sendPaymentReceiptEmail(
  email: string,
  name: string | undefined,
  amount: number | undefined,
  currency: string | undefined,
): Promise<void> {
  const amountLabel =
    amount !== undefined && currency ? `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}` : "your payment";
  await sendEmail({
    to: email,
    subject: "Payment received — thank you",
    text: `${greet(name)},\n\nWe've received ${amountLabel}. Thanks for staying with Rizly.\n\n— The Rizly team`,
    html: `<p>${greet(name)},</p><p>We've received <strong>${amountLabel}</strong>. Thanks for staying with Rizly.</p><p>— The Rizly team</p>`,
  });
}
