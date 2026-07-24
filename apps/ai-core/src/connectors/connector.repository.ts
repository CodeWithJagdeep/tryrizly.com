import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import type { ConnectedAccount, ConnectorProvider } from "./connector.types";

const inMemoryAccounts = new Map<string, ConnectedAccount>();
const inMemoryOAuthStates = new Map<
  string,
  {
    stateId: string;
    userId: string;
    provider: ConnectorProvider;
    returnTo?: string;
    encryptedPayload?: string;
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

  /**
   * Upsert an OAuth account. By default keyed by (userId, provider) — one row
   * per provider. Pass `opts.externalId` (e.g. the Google account email) to key
   * by (userId, provider, externalId) instead, so multiple accounts of the same
   * provider coexist as separate rows and reconnecting one updates it in place.
   */
  async upsert(
    account: Omit<ConnectedAccount, "id" | "createdAt" | "updatedAt">,
    opts?: { externalId?: string },
  ) {
    const now = new Date().toISOString();
    const existing = opts?.externalId
      ? (await this.findAll(account.userId, account.provider)).find(
          (a) =>
            (a.metadata?.accountEmail as string | undefined) ===
            opts.externalId,
        )
      : await this.find(account.userId, account.provider);
    const next: ConnectedAccount = {
      ...account,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (!this.pool) {
      // Multi-account rows are keyed by id; single-provider rows by (userId, provider).
      inMemoryAccounts.set(
        opts?.externalId ? next.id : this.key(account.userId, account.provider),
        next,
      );
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
  async insert(
    account: Omit<ConnectedAccount, "createdAt" | "updatedAt">,
  ): Promise<ConnectedAccount> {
    const now = new Date().toISOString();
    const next: ConnectedAccount = {
      ...account,
      createdAt: now,
      updatedAt: now,
    };

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

  /** Update an existing account by id. */
  async updateById(
    id: string,
    patch: Partial<
      Pick<
        ConnectedAccount,
        "label" | "status" | "encryptedPayload" | "metadata"
      >
    >,
  ): Promise<void> {
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = [...inMemoryAccounts.values()].find((a) => a.id === id);
      if (existing)
        inMemoryAccounts.set(id, { ...existing, ...patch, updatedAt: now });
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
      [
        id,
        patch.label ?? null,
        patch.status ?? null,
        patch.encryptedPayload ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        now,
      ],
    );
  }

  /** Atomically update an account only when it belongs to this tenant and provider. */
  async updateOwned(
    id: string,
    userId: string,
    provider: ConnectorProvider,
    patch: Partial<
      Pick<
        ConnectedAccount,
        "label" | "status" | "encryptedPayload" | "metadata"
      >
    >,
  ): Promise<ConnectedAccount | undefined> {
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = [...inMemoryAccounts.values()].find(
        (account) => account.id === id,
      );
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== provider
      )
        return undefined;
      const updated = { ...existing, ...patch, updatedAt: now };
      inMemoryAccounts.set(id, updated);
      return updated;
    }
    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `update connected_accounts set
        label = coalesce($4, label),
        status = coalesce($5, status),
        encrypted_payload = coalesce($6, encrypted_payload),
        metadata = coalesce($7::jsonb, metadata),
        updated_at = $8
       where id = $1 and user_id = $2 and provider = $3
       returning id, user_id as "userId", provider, auth_type as "authType", label,
         status, encrypted_payload as "encryptedPayload", scopes, metadata,
         created_at as "createdAt", updated_at as "updatedAt"`,
      [
        id,
        userId,
        provider,
        patch.label ?? null,
        patch.status ?? null,
        patch.encryptedPayload ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        now,
      ],
    );
    return result.rows[0];
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
      return (
        inMemoryAccounts.get(this.key(userId, provider)) ??
        [...inMemoryAccounts.values()].find(
          (account) =>
            account.userId === userId && account.provider === provider,
        )
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
      where user_id = $1 and provider = $2
      order by created_at asc
      limit 1
      `,
      [userId, provider],
    );

    return result.rows[0];
  }

  /**
   * Cross-user lookup by provider metadata (e.g. Notion's workspace_id) —
   * every other query here is scoped to one userId; a webhook event carries
   * only the external workspace id, so we need to search the other direction.
   */
  async findAllByProviderAndWorkspace(
    provider: ConnectorProvider,
    workspaceId: string,
  ): Promise<ConnectedAccount[]> {
    if (!this.pool) {
      return [...inMemoryAccounts.values()].filter(
        (a) =>
          a.provider === provider &&
          (a.metadata?.workspaceId as string | undefined) === workspaceId,
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
      where provider = $1 and metadata->>'workspaceId' = $2
      `,
      [provider, workspaceId],
    );
    return result.rows;
  }

  /** Find all accounts for a given provider (e.g. multiple Postgres connections). */
  async findAll(
    userId: string,
    provider: ConnectorProvider,
  ): Promise<ConnectedAccount[]> {
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

  async findGmailAccountsByEmail(
    emailAddress: string,
  ): Promise<ConnectedAccount[]> {
    const normalized = emailAddress.trim().toLowerCase();
    if (!normalized) return [];
    if (!this.pool) {
      return [...inMemoryAccounts.values()].filter(
        (account) =>
          account.provider === "gmail" &&
          account.status === "connected" &&
          String(account.metadata.accountEmail ?? "").toLowerCase() ===
            normalized,
      );
    }
    await this.ensureTable();
    const result = await this.pool.query<ConnectedAccount>(
      `select id, user_id as "userId", provider, auth_type as "authType", label,
              status, encrypted_payload as "encryptedPayload", scopes, metadata,
              created_at as "createdAt", updated_at as "updatedAt"
         from connected_accounts
        where provider = 'gmail'
          and status = 'connected'
          and lower(metadata->>'accountEmail') = $1`,
      [normalized],
    );
    return result.rows;
  }

  /**
   * Advances the Gmail history cursor atomically and monotonically. Pub/Sub may
   * deliver notifications concurrently or out of order; an older job must
   * never move the cursor backwards and create a synchronization gap.
   */
  async advanceGmailHistoryCursor(
    id: string,
    userId: string,
    historyId: string,
  ): Promise<boolean> {
    if (!/^\d+$/.test(historyId)) return false;
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = [...inMemoryAccounts.values()].find(
        (account) =>
          account.id === id &&
          account.userId === userId &&
          account.provider === "gmail",
      );
      if (!existing) return false;
      const current = String(existing.metadata.gmailWatchHistoryId ?? "0");
      if (/^\d+$/.test(current) && BigInt(current) >= BigInt(historyId)) {
        return false;
      }
      inMemoryAccounts.set(id, {
        ...existing,
        metadata: {
          ...existing.metadata,
          gmailWatchHistoryId: historyId,
          gmailLastPushAt: now,
        },
        updatedAt: now,
      });
      return true;
    }
    await this.ensureTable();
    const result = await this.pool.query(
      `update connected_accounts
          set metadata = metadata || jsonb_build_object(
                'gmailWatchHistoryId', $3::text,
                'gmailLastPushAt', $4::text
              ),
              updated_at = $4
        where id = $1
          and user_id = $2
          and provider = 'gmail'
          and coalesce(
            case
              when metadata->>'gmailWatchHistoryId' ~ '^[0-9]+$'
                then (metadata->>'gmailWatchHistoryId')::numeric
              else 0
            end,
            0
          ) < $3::numeric`,
      [id, userId, historyId, now],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Records a renewed Gmail watch without replacing unrelated connector
   * metadata. The cursor is monotonic because an immediate Pub/Sub delivery
   * may race the users.watch response.
   */
  async recordGmailWatch(
    id: string,
    userId: string,
    historyId: string,
    expiration: string,
  ): Promise<boolean> {
    if (!/^\d+$/.test(historyId) || !/^\d+$/.test(expiration)) return false;
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = [...inMemoryAccounts.values()].find(
        (account) =>
          account.id === id &&
          account.userId === userId &&
          account.provider === "gmail",
      );
      if (!existing) return false;
      const current = String(existing.metadata.gmailWatchHistoryId ?? "0");
      const nextHistoryId =
        /^\d+$/.test(current) && BigInt(current) > BigInt(historyId)
          ? current
          : historyId;
      inMemoryAccounts.set(id, {
        ...existing,
        metadata: {
          ...existing.metadata,
          gmailWatchHistoryId: nextHistoryId,
          gmailWatchExpiration: expiration,
          gmailWatchRenewedAt: now,
        },
        updatedAt: now,
      });
      return true;
    }
    await this.ensureTable();
    const result = await this.pool.query(
      `update connected_accounts
          set metadata = metadata || jsonb_build_object(
                'gmailWatchHistoryId',
                case
                  when coalesce(
                    case
                      when metadata->>'gmailWatchHistoryId' ~ '^[0-9]+$'
                        then (metadata->>'gmailWatchHistoryId')::numeric
                      else 0
                    end,
                    0
                  ) > $3::numeric
                    then metadata->>'gmailWatchHistoryId'
                  else $3::text
                end,
                'gmailWatchExpiration', $4::text,
                'gmailWatchRenewedAt', $5::text
              ),
              updated_at = $5
        where id = $1
          and user_id = $2
          and provider = 'gmail'`,
      [id, userId, historyId, expiration, now],
    );
    return (result.rowCount ?? 0) > 0;
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

  async deleteAll(userId: string): Promise<number> {
    if (!this.pool) {
      let removed = 0;
      for (const [key, account] of inMemoryAccounts) {
        if (account.userId === userId) {
          inMemoryAccounts.delete(key);
          removed += 1;
        }
      }
      for (const [stateId, state] of inMemoryOAuthStates) {
        if (state.userId === userId) inMemoryOAuthStates.delete(stateId);
      }
      return removed;
    }

    await this.ensureTable();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "delete from connector_oauth_states where user_id = $1",
        [userId],
      );
      const result = await client.query(
        "delete from connected_accounts where user_id = $1",
        [userId],
      );
      await client.query("commit");
      return result.rowCount ?? 0;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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

  async listUserIds(
    provider?: ConnectorProvider | ConnectorProvider[],
  ): Promise<string[]> {
    const providers =
      provider === undefined
        ? undefined
        : ([] as ConnectorProvider[]).concat(provider);

    if (!this.pool) {
      const accounts = [...inMemoryAccounts.values()].filter(
        (account) =>
          account.status === "connected" &&
          (!providers || providers.includes(account.provider)),
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
    encryptedPayload?: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.pool) {
      inMemoryOAuthStates.set(input.stateId, input);
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `insert into connector_oauth_states (state_id, user_id, provider, return_to, encrypted_payload, expires_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        input.stateId,
        input.userId,
        input.provider,
        input.returnTo ?? null,
        input.encryptedPayload ?? null,
        input.expiresAt,
      ],
    );
  }

  async consumeOAuthState(
    stateId: string,
    provider: ConnectorProvider,
  ): Promise<
    { userId: string; returnTo?: string; encryptedPayload?: string } | undefined
  > {
    if (!this.pool) {
      const record = inMemoryOAuthStates.get(stateId);
      inMemoryOAuthStates.delete(stateId);
      if (
        !record ||
        record.provider !== provider ||
        record.expiresAt.getTime() < Date.now()
      ) {
        return undefined;
      }
      return {
        userId: record.userId,
        returnTo: record.returnTo,
        encryptedPayload: record.encryptedPayload,
      };
    }

    await this.ensureTable();
    await this.pool.query(
      "delete from connector_oauth_states where expires_at < now()",
    );
    const result = await this.pool.query<{
      userId: string;
      returnTo: string | null;
      encryptedPayload: string | null;
    }>(
      `delete from connector_oauth_states
        where state_id = $1 and provider = $2 and expires_at >= now()
        returning user_id as "userId", return_to as "returnTo", encrypted_payload as "encryptedPayload"`,
      [stateId, provider],
    );
    const row = result.rows[0];
    return row
      ? {
          userId: row.userId,
          returnTo: row.returnTo ?? undefined,
          encryptedPayload: row.encryptedPayload ?? undefined,
        }
      : undefined;
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
        encrypted_payload text,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )
    `);
    await this.pool.query(
      "alter table connector_oauth_states add column if not exists encrypted_payload text",
    );
    await this.pool.query(
      "create index if not exists connector_oauth_states_expires on connector_oauth_states (expires_at)",
    );
  }
}
