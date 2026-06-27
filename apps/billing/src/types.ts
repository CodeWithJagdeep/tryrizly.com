export type BillingPlanKind = "free" | "subscription" | "one_time";

export type BillingPlan = {
  id: string;
  name: string;
  kind: BillingPlanKind;
  description: string;
  currency: string;
  amount: number;
  interval?: "month" | "year";
  trialDays: number;
  aiBudgetUsd: number;
  seats: number;
  features: string[];
  razorpayPlanId?: string;
};

export type BillingCustomerInput = {
  userId: string;
  email?: string;
  name?: string;
};

export type BillingTrialInput = BillingCustomerInput & {
  planId?: string;
};

export type BillingCheckoutInput = BillingCustomerInput & {
  planId: string;
  returnUrl?: string;
};

export type BillingCancelInput = BillingCustomerInput & {
  subscriptionId?: string;
  providerSubscriptionId?: string;
};

export type BillingWebhookInput = {
  provider: "razorpay";
  eventId?: string;
  signature?: string;
  rawBody: string;
  payload: Record<string, unknown>;
};

export type BillingSubscriptionRecord = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: string;
  provider_subscription_id?: string | null;
  status: string;
  current_period_end?: Date | null;
  trial_ends_at?: Date | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type BillingTrialRecord = {
  user_id: string;
  plan_id: string;
  started_at: Date;
  ends_at: Date;
  consumed: boolean;
};

export type BillingPurchaseRecord = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: string;
  provider_order_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};
