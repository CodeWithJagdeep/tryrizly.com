import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, type QueryResultRow } from "pg";
import { randomUUID } from "crypto";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import type {
  BillingPurchaseRecord,
  BillingSubscriptionRecord,
  BillingTrialRecord,
} from "./types";

type PgError = Error & { code?: string };

@Injectable()
export class BillingRepository implements OnModuleInit, OnModuleDestroy {
  private readonly pool = env.DATABASE_URL
    ? new Pool({ connectionString: env.DATABASE_URL })
    : null;

  async onModuleInit() {
    if (!this.pool) {
      logger.warn("billing database disabled because DATABASE_URL is not set");
      return;
    }

    await this.pool.query(`
      create table if not exists billing_customers (
        user_id text primary key,
        email text,
        name text,
        provider_customer_id text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists billing_trials (
        user_id text primary key,
        plan_id text not null,
        started_at timestamptz not null,
        ends_at timestamptz not null,
        consumed boolean not null default false
      );

      create table if not exists billing_subscriptions (
        id uuid primary key,
        user_id text not null,
        plan_id text not null,
        provider text not null,
        provider_subscription_id text unique,
        status text not null,
        current_period_end timestamptz,
        trial_ends_at timestamptz,
        cancel_at_period_end boolean not null default false,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists billing_subscriptions_user_status_idx
        on billing_subscriptions (user_id, status, updated_at desc);

      create table if not exists billing_purchases (
        id uuid primary key,
        user_id text not null,
        plan_id text not null,
        provider text not null,
        provider_order_id text unique,
        amount integer not null,
        currency text not null,
        status text not null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists billing_purchases_user_status_idx
        on billing_purchases (user_id, status, updated_at desc);

      create table if not exists billing_events (
        id uuid primary key,
        provider text not null,
        event_id text not null unique,
        event_type text not null,
        payload jsonb not null,
        created_at timestamptz not null default now()
      );

      create table if not exists billing_provider_plans (
        provider text not null,
        local_plan_id text not null,
        provider_plan_id text not null,
        created_at timestamptz not null default now(),
        primary key (provider, local_plan_id)
      );
    `);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  databaseConfigured() {
    return Boolean(this.pool);
  }

  async databaseHealthy(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      await this.pool.query("select 1");
      return true;
    } catch {
      return false;
    }
  }

  async upsertCustomer(input: { userId: string; email?: string; name?: string }) {
    await this.query(
      `
        insert into billing_customers (user_id, email, name)
        values ($1, $2, $3)
        on conflict (user_id) do update set
          email = coalesce(excluded.email, billing_customers.email),
          name = coalesce(excluded.name, billing_customers.name),
          updated_at = now()
      `,
      [input.userId, input.email ?? null, input.name ?? null],
    );
  }

  async findCustomer(userId: string): Promise<{ user_id: string; email: string | null; name: string | null } | null> {
    const result = await this.query<{ user_id: string; email: string | null; name: string | null }>(
      "select user_id, email, name from billing_customers where user_id = $1",
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async findTrial(userId: string): Promise<BillingTrialRecord | null> {
    const result = await this.query<BillingTrialRecord>(
      "select * from billing_trials where user_id = $1",
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async createTrial(input: {
    userId: string;
    planId: string;
    startedAt: Date;
    endsAt: Date;
  }): Promise<BillingTrialRecord> {
    const result = await this.query<BillingTrialRecord>(
      `
        insert into billing_trials (user_id, plan_id, started_at, ends_at)
        values ($1, $2, $3, $4)
        returning *
      `,
      [input.userId, input.planId, input.startedAt, input.endsAt],
    );
    return result.rows[0];
  }

  /** Trials still running that end within `days` days — sweep nudge candidates. */
  async findTrialsEndingWithin(days: number): Promise<BillingTrialRecord[]> {
    const result = await this.query<BillingTrialRecord>(
      `
        select * from billing_trials
        where consumed = false
          and ends_at > now()
          and ends_at <= now() + ($1 || ' days')::interval
      `,
      [days],
    );
    return result.rows;
  }

  /** Trials past their end date whose expiry hasn't been processed yet. */
  async findExpiredUnconsumedTrials(): Promise<BillingTrialRecord[]> {
    const result = await this.query<BillingTrialRecord>(
      "select * from billing_trials where consumed = false and ends_at <= now()",
    );
    return result.rows;
  }

  async markTrialConsumed(userId: string) {
    await this.query("update billing_trials set consumed = true where user_id = $1", [userId]);
  }

  /**
   * Provider subscriptions that still look active locally but whose paid period
   * lapsed more than a day ago — a missed webhook until proven otherwise.
   */
  async findLapsedProviderSubscriptions(): Promise<BillingSubscriptionRecord[]> {
    const result = await this.query<BillingSubscriptionRecord>(
      `
        select * from billing_subscriptions
        where provider = 'razorpay'
          and provider_subscription_id is not null
          and status in ('active', 'authenticated')
          and current_period_end is not null
          and current_period_end < now() - interval '1 day'
      `,
    );
    return result.rows;
  }

  /**
   * Active provider subscriptions whose next charge lands within `days` and
   * that aren't already set to stop at period end — the renewal-notice cohort.
   */
  async findSubscriptionsRenewingWithin(days: number): Promise<BillingSubscriptionRecord[]> {
    const result = await this.query<BillingSubscriptionRecord>(
      `
        select * from billing_subscriptions
        where provider = 'razorpay'
          and provider_subscription_id is not null
          and status in ('active', 'authenticated')
          and cancel_at_period_end = false
          and current_period_end > now()
          and current_period_end <= now() + ($1 || ' days')::interval
      `,
      [days],
    );
    return result.rows;
  }

  async createSubscription(input: {
    userId: string;
    planId: string;
    provider: string;
    providerSubscriptionId?: string | null;
    status: string;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSubscriptionRecord> {
    const result = await this.query<BillingSubscriptionRecord>(
      `
        insert into billing_subscriptions (
          id,
          user_id,
          plan_id,
          provider,
          provider_subscription_id,
          status,
          current_period_end,
          trial_ends_at,
          cancel_at_period_end,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (provider_subscription_id) do update set
          plan_id = excluded.plan_id,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          trial_ends_at = excluded.trial_ends_at,
          cancel_at_period_end = excluded.cancel_at_period_end,
          metadata = billing_subscriptions.metadata || excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        randomUUID(),
        input.userId,
        input.planId,
        input.provider,
        input.providerSubscriptionId ?? null,
        input.status,
        input.currentPeriodEnd ?? null,
        input.trialEndsAt ?? null,
        input.cancelAtPeriodEnd ?? false,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0];
  }

  async updateSubscriptionByProvider(input: {
    providerSubscriptionId: string;
    userId?: string;
    planId?: string;
    provider?: string;
    status: string;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSubscriptionRecord> {
    const existing = await this.findSubscriptionByProviderId(input.providerSubscriptionId);
    if (!existing) {
      return this.createSubscription({
        userId: input.userId ?? "unknown",
        planId: input.planId ?? "unknown",
        provider: input.provider ?? "razorpay",
        providerSubscriptionId: input.providerSubscriptionId,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
        trialEndsAt: input.trialEndsAt,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        metadata: input.metadata,
      });
    }

    const result = await this.query<BillingSubscriptionRecord>(
      `
        update billing_subscriptions set
          user_id = case when user_id like 'deleted:%' then user_id else coalesce($2, user_id) end,
          plan_id = coalesce($3, plan_id),
          provider = coalesce($4, provider),
          status = $5,
          current_period_end = coalesce($6, current_period_end),
          trial_ends_at = coalesce($7, trial_ends_at),
          cancel_at_period_end = coalesce($8, cancel_at_period_end),
          metadata = metadata || $9::jsonb,
          updated_at = now()
        where provider_subscription_id = $1
        returning *
      `,
      [
        input.providerSubscriptionId,
        input.userId ?? null,
        input.planId ?? null,
        input.provider ?? null,
        input.status,
        input.currentPeriodEnd ?? null,
        input.trialEndsAt ?? null,
        input.cancelAtPeriodEnd ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0];
  }

  async findSubscriptionByProviderId(
    providerSubscriptionId: string,
  ): Promise<BillingSubscriptionRecord | null> {
    const result = await this.query<BillingSubscriptionRecord>(
      "select * from billing_subscriptions where provider_subscription_id = $1",
      [providerSubscriptionId],
    );
    return result.rows[0] ?? null;
  }

  async findSubscriptionById(
    id: string,
    userId: string,
  ): Promise<BillingSubscriptionRecord | null> {
    const result = await this.query<BillingSubscriptionRecord>(
      "select * from billing_subscriptions where id = $1 and user_id = $2",
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  async findCurrentSubscription(userId: string): Promise<BillingSubscriptionRecord | null> {
    const result = await this.query<BillingSubscriptionRecord>(
      `
        select *
        from billing_subscriptions
        where user_id = $1
        order by
          case status
            when 'active' then 1
            when 'authenticated' then 2
            when 'trialing' then 3
            when 'created' then 4
            when 'pending' then 5
            else 9
          end,
          updated_at desc
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async cancelSubscription(input: {
    id?: string;
    providerSubscriptionId?: string;
    userId: string;
  }): Promise<BillingSubscriptionRecord | null> {
    const result = await this.query<BillingSubscriptionRecord>(
      `
        update billing_subscriptions set
          status = 'cancelled',
          cancel_at_period_end = true,
          updated_at = now()
        where user_id = $1
          and ($2::uuid is null or id = $2::uuid)
          and ($3::text is null or provider_subscription_id = $3)
        returning *
      `,
      [input.userId, input.id ?? null, input.providerSubscriptionId ?? null],
    );
    return result.rows[0] ?? null;
  }

  async createPurchase(input: {
    userId: string;
    planId: string;
    provider: string;
    providerOrderId?: string | null;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingPurchaseRecord> {
    const result = await this.query<BillingPurchaseRecord>(
      `
        insert into billing_purchases (
          id,
          user_id,
          plan_id,
          provider,
          provider_order_id,
          amount,
          currency,
          status,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (provider_order_id) do update set
          status = excluded.status,
          metadata = billing_purchases.metadata || excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        randomUUID(),
        input.userId,
        input.planId,
        input.provider,
        input.providerOrderId ?? null,
        input.amount,
        input.currency,
        input.status,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0];
  }

  async updatePurchaseByProviderOrder(input: {
    providerOrderId: string;
    userId?: string;
    planId?: string;
    provider?: string;
    amount?: number;
    currency?: string;
    status: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingPurchaseRecord> {
    const result = await this.query<BillingPurchaseRecord>(
      `
        insert into billing_purchases (
          id,
          user_id,
          plan_id,
          provider,
          provider_order_id,
          amount,
          currency,
          status,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (provider_order_id) do update set
          user_id = case
            when billing_purchases.user_id like 'deleted:%' then billing_purchases.user_id
            else coalesce(nullif(excluded.user_id, 'unknown'), billing_purchases.user_id)
          end,
          plan_id = coalesce(nullif(excluded.plan_id, 'unknown'), billing_purchases.plan_id),
          status = excluded.status,
          amount = coalesce(excluded.amount, billing_purchases.amount),
          currency = coalesce(excluded.currency, billing_purchases.currency),
          metadata = billing_purchases.metadata || excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        randomUUID(),
        input.userId ?? "unknown",
        input.planId ?? "unknown",
        input.provider ?? "razorpay",
        input.providerOrderId,
        input.amount ?? 0,
        input.currency ?? "INR",
        input.status,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0];
  }

  async findCurrentPurchase(userId: string): Promise<BillingPurchaseRecord | null> {
    const result = await this.query<BillingPurchaseRecord>(
      `
        select *
        from billing_purchases
        where user_id = $1
        order by
          case status
            when 'paid' then 1
            when 'captured' then 2
            when 'created' then 3
            else 9
          end,
          updated_at desc
        limit 1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async anonymizeUserData(userId: string, anonymousUserId: string): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const customer = await client.query<{ provider_customer_id: string | null }>(
        "select provider_customer_id from billing_customers where user_id = $1",
        [userId],
      );
      const providerCustomerId = customer.rows[0]?.provider_customer_id;

      await client.query("delete from billing_trials where user_id = $1", [userId]);
      await client.query("delete from billing_customers where user_id = $1", [userId]);
      await client.query(
        `update billing_subscriptions
           set user_id = $2, metadata = '{"retainedFor":"accounting"}'::jsonb, updated_at = now()
         where user_id = $1`,
        [userId, anonymousUserId],
      );
      await client.query(
        `update billing_purchases
           set user_id = $2, metadata = '{"retainedFor":"accounting"}'::jsonb, updated_at = now()
         where user_id = $1`,
        [userId, anonymousUserId],
      );
      await client.query(
        `update billing_events
           set payload = '{"redacted":true,"retainedFor":"fraud-and-accounting"}'::jsonb
         where strpos(payload::text, $1) > 0
            or ($2::text is not null and strpos(payload::text, $2) > 0)`,
        [userId, providerCustomerId ?? null],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async hasDeletedProviderReference(providerReferences: string[]): Promise<boolean> {
    const references = providerReferences.filter(Boolean);
    if (references.length === 0) return false;
    const result = await this.query<{ found: boolean }>(
      `select exists (
         select 1 from billing_subscriptions
          where provider_subscription_id = any($1::text[]) and user_id like 'deleted:%'
         union all
         select 1 from billing_purchases
          where provider_order_id = any($1::text[]) and user_id like 'deleted:%'
       ) as found`,
      [references],
    );
    return result.rows[0]?.found ?? false;
  }

  async findProviderPlanId(provider: string, localPlanId: string): Promise<string | null> {
    const result = await this.query<{ provider_plan_id: string }>(
      "select provider_plan_id from billing_provider_plans where provider = $1 and local_plan_id = $2",
      [provider, localPlanId],
    );
    return result.rows[0]?.provider_plan_id ?? null;
  }

  async saveProviderPlanId(provider: string, localPlanId: string, providerPlanId: string) {
    await this.query(
      `
        insert into billing_provider_plans (provider, local_plan_id, provider_plan_id)
        values ($1, $2, $3)
        on conflict (provider, local_plan_id) do nothing
      `,
      [provider, localPlanId, providerPlanId],
    );
  }

  async insertEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      await this.query(
        `
          insert into billing_events (id, provider, event_id, event_type, payload)
          values ($1, $2, $3, $4, $5)
        `,
        [
          randomUUID(),
          input.provider,
          input.eventId,
          input.eventType,
          JSON.stringify(input.payload),
        ],
      );
      return true;
    } catch (error) {
      if ((error as PgError).code === "23505") return false;
      throw error;
    }
  }

  private query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) {
    if (!this.pool) {
      throw new Error("billing_database_not_configured");
    }
    return this.pool.query<T>(sql, values);
  }
}
