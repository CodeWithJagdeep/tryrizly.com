import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import type {
  ConnectedAccount,
  ConnectorProvider,
} from "./connector.types";

const inMemoryAccounts = new Map<string, ConnectedAccount>();
const inMemoryOAuthStates = new Map<
  string,
  {
    stateId: string;
    userId: string;
    provider: ConnectorProvider;
    returnTo?: string;
    expiresAt: Date;
  }
>();

@Injectable()
export class ConnectorRepository implements OnModuleDestroy {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: env.DATABASE_URL,
      });
    }
  }

  /** Upsert by (userId, provider) — used for OAuth flows where there is always exactly one account per provider. */
  async upsert(account: Omit<ConnectedAccount, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const existing = await this.find(account.userId, account.provider);
    const next: ConnectedAccount = {
      ...account,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (!this.pool) {
      inMemoryAccounts.set(this.key(account.userId, account.provider), next);
      return next;
    }

    await this.ensureTable();
    const row = await this.pool.query<ConnectedAccount>(
      `
      insert into connected_accounts (
        id, user_id, provider, auth_type, label, status, encrypted_payload,
        scopes, metadata, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      on conflict (id)
      do update set
        auth_type = excluded.auth_type,
        label = excluded.label,
        status = excluded.status,
        encrypted_payload = excluded.encrypted_payload,
        scopes = excluded.scopes,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
      returning
        id,
        user_id as "userId",
        provider,
        auth_type as "authType",
        label,
        status,
        encrypted_payload as "encryptedPayload",
        scopes,
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [
        next.id,
        next.userId,
        next.provider,
        next.authType,
        next.label,
        next.status,
        next.encryptedPayload,
        JSON.stringify(next.scopes),
        JSON.stringify(next.metadata),
        next.createdAt,
        next.updatedAt,
      ],
    );

    return row.rows[0];
  }

  /** Insert a new named account (for manual multi-account DB connectors). */
  async insert(account: Omit<ConnectedAccount, "createdAt" | "updatedAt">): Promise<ConnectedAccount> {
    const now = new Date().toISOString();
    const next: ConnectedAccount = { ...account, createdAt: now, updatedAt: now };

    if (!this.pool) {
      inMemoryAccounts.set(next.id, next);
      return next;
    }

    await this.ensureTable();
    const row = await this.pool.query<ConnectedAccount>(
      `
      insert into connected_accounts (
        id, user_id, provider, auth_type, label, status, encrypted_payload,
        scopes, metadata, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      returning
        id, user_id as "userId", provider, auth_type as "authType", label,
        status, encrypted_payload as "encryptedPayload", scopes, metadata,
        created_at as "createdAt", updated_at as "updatedAt"
      `,
      [
        next.id, next.userId, next.provider, next.authType, next.label,
        next.status, next.encryptedPayload, JSON.stringify(next.scopes),
        JSON.stringify(next.metadata), next.createdAt, next.updatedAt,
      ],
    );
    return row.rows[0];
  }

  /** Update an existing account by id. */
  async updateById(id: string, patch: Partial<Pick<ConnectedAccount, "label" | "status" | "encryptedPayload" | "metadata">>): Promise<void> {
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = [...inMemoryAccounts.values()].find((a) => a.id === id);
      if (existing) inMemoryAccounts.set(id, { ...existing, ...patch, updatedAt: now });
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `update connected_accounts set
        label = coalesce($2, label),
        status = coalesce($3, status),
        encrypted_payload = coalesce($4, encrypted_payload),
        metadata = coalesce($5::jsonb, metadata),
        updated_at = $6
       where id = $1`,
      [id, patch.label ?? null, patch.status ?? null, patch.encryptedPayload ?? null,
       patch.metadata ? JSON.stringify(patch.metadata) : null, now],
    );
  }

  async list(userId: string) {
    if (!this.pool) {
      return [...inMemoryAccounts.values()].filter(
        (account) => account.userId === userId,
      );
    }

    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `
      select
        id,
        user_id as "userId",
        provider,
        auth_type as "authType",
        label,
        status,
        encrypted_payload as "encryptedPayload",
        scopes,
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from connected_accounts
      where user_id = $1
      order by provider asc
      `,
      [userId],
    );

    return result.rows;
  }

  async find(userId: string, provider: ConnectorProvider) {
    if (!this.pool) {
      return inMemoryAccounts.get(this.key(userId, provider));
    }

    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `
      select
        id,
        user_id as "userId",
        provider,
        auth_type as "authType",
        label,
        status,
        encrypted_payload as "encryptedPayload",
        scopes,
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from connected_accounts
      where user_id = $1 and provider = $2
      limit 1
      `,
      [userId, provider],
    );

    return result.rows[0];
  }

  /** Find all accounts for a given provider (e.g. multiple Postgres connections). */
  async findAll(userId: string, provider: ConnectorProvider): Promise<ConnectedAccount[]> {
    if (!this.pool) {
      return [...inMemoryAccounts.values()].filter(
        (a) => a.userId === userId && a.provider === provider,
      );
    }
    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `select id, user_id as "userId", provider, auth_type as "authType", label,
              status, encrypted_payload as "encryptedPayload", scopes, metadata,
              created_at as "createdAt", updated_at as "updatedAt"
         from connected_accounts
        where user_id = $1 and provider = $2
        order by created_at asc`,
      [userId, provider],
    );
    return result.rows;
  }

  async findById(id: string): Promise<ConnectedAccount | undefined> {
    if (!this.pool) {
      return [...inMemoryAccounts.values()].find((a) => a.id === id);
    }
    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `select id, user_id as "userId", provider, auth_type as "authType", label,
              status, encrypted_payload as "encryptedPayload", scopes, metadata,
              created_at as "createdAt", updated_at as "updatedAt"
         from connected_accounts where id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async delete(userId: string, provider: ConnectorProvider) {
    if (!this.pool) {
      return inMemoryAccounts.delete(this.key(userId, provider));
    }

    await this.ensureTable();
    await this.pool.query(
      "delete from connected_accounts where user_id = $1 and provider = $2",
      [userId, provider],
    );
    return true;
  }

  async deleteById(id: string): Promise<boolean> {
    if (!this.pool) {
      return inMemoryAccounts.delete(id);
    }
    await this.ensureTable();
    const result = await this.pool.query(
      "delete from connected_accounts where id = $1",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listUserIds(provider?: ConnectorProvider | ConnectorProvider[]): Promise<string[]> {
    const providers = provider === undefined ? undefined : ([] as ConnectorProvider[]).concat(provider);

    if (!this.pool) {
      const accounts = [...inMemoryAccounts.values()].filter(
        (account) =>
          account.status === "connected" && (!providers || providers.includes(account.provider)),
      );
      return [...new Set(accounts.map((account) => account.userId))];
    }

    await this.ensureTable();
    const result = await this.pool.query<{ userId: string }>(
      `select distinct user_id as "userId"
         from connected_accounts
        where status = 'connected' ${providers ? "and provider = any($1)" : ""}
        order by user_id asc`,
      providers ? [providers] : [],
    );
    return result.rows.map((row) => row.userId);
  }

  async createOAuthState(input: {
    stateId: string;
    userId: string;
    provider: ConnectorProvider;
    returnTo?: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.pool) {
      inMemoryOAuthStates.set(input.stateId, input);
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `insert into connector_oauth_states (state_id, user_id, provider, return_to, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [input.stateId, input.userId, input.provider, input.returnTo ?? null, input.expiresAt],
    );
  }

  async consumeOAuthState(
    stateId: string,
    provider: ConnectorProvider,
  ): Promise<{ userId: string; returnTo?: string } | undefined> {
    if (!this.pool) {
      const record = inMemoryOAuthStates.get(stateId);
      inMemoryOAuthStates.delete(stateId);
      if (!record || record.provider !== provider || record.expiresAt.getTime() < Date.now()) {
        return undefined;
      }
      return { userId: record.userId, returnTo: record.returnTo };
    }

    await this.ensureTable();
    await this.pool.query("delete from connector_oauth_states where expires_at < now()");
    const result = await this.pool.query<{ userId: string; returnTo: string | null }>(
      `delete from connector_oauth_states
        where state_id = $1 and provider = $2 and expires_at >= now()
        returning user_id as "userId", return_to as "returnTo"`,
      [stateId, provider],
    );
    const row = result.rows[0];
    return row ? { userId: row.userId, returnTo: row.returnTo ?? undefined } : undefined;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private key(userId: string, provider: ConnectorProvider) {
    return `${userId}:${provider}`;
  }

  private async ensureTable() {
    if (!this.pool) {
      return;
    }

    await this.pool.query(`
      create table if not exists connected_accounts (
        id text primary key,
        user_id text not null,
        provider text not null,
        auth_type text not null,
        label text not null,
        status text not null,
        encrypted_payload text not null,
        scopes jsonb not null default '[]'::jsonb,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `);
    // Drop the old per-provider unique constraint so multiple named accounts can coexist.
    await this.pool.query(
      `alter table connected_accounts drop constraint if exists connected_accounts_user_id_provider_key`,
    );
    await this.pool.query(`
      create table if not exists connector_oauth_states (
        state_id text primary key,
        user_id text not null,
        provider text not null,
        return_to text,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(
      "create index if not exists connector_oauth_states_expires on connector_oauth_states (expires_at)",
    );
  }
}
