import { createHash } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { validateAgainstSchema, validateReadOnlySql } from "./sql-guard";

export type IntrospectedColumn = { name: string; dataType: string; nullable: boolean };
export type IntrospectedTable = {
  schema?: string;
  name: string;
  columns: IntrospectedColumn[];
};
export type PostgresIntrospectedSchema = { tables: IntrospectedTable[] };

type CacheEntry = { at: number; schema: PostgresIntrospectedSchema };
type PoolEntry = { pool: Pool; lastUsedAt: number };
const MAX_POOLS = 32;
const MAX_SCHEMA_CACHE_ENTRIES = 128;

/**
 * Talks to a principal's OWN external Postgres database (vault-stored
 * connectionUrl) — distinct from ConnectorRepository's pool, which is
 * heyriz's own app database. One pool per connection string, schema cached
 * in-process since it's cheap to recompute and non-sensitive (names only).
 */
@Injectable()
export class PostgresIntrospectionService implements OnModuleDestroy {
  private readonly pools = new Map<string, PoolEntry>();
  private readonly schemaCache = new Map<string, CacheEntry>();

  /**
   * Connector-save boundary: prove the URL works and reject credentials that
   * can create schema objects or mutate user tables. Runtime queries are still
   * wrapped in `BEGIN READ ONLY`; this additionally keeps write-capable secrets
   * out of the vault.
   */
  async assertReadOnlyCredentials(connectionUrl: string): Promise<void> {
    assertPostgresUrl(connectionUrl);
    const pool = this.poolFor(connectionUrl);
    try {
      const result = await pool.query<{
        rolsuper: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
        canCreateDatabaseObjects: boolean;
        canCreateSchemaObjects: boolean;
        canWriteTables: boolean;
      }>(`
      select
        r.rolsuper,
        r.rolcreaterole,
        r.rolcreatedb,
        r.rolreplication,
        r.rolbypassrls,
        has_database_privilege(current_user, current_database(), 'CREATE') as "canCreateDatabaseObjects",
        coalesce((
          select bool_or(has_schema_privilege(current_user, n.oid, 'CREATE'))
          from pg_namespace n
          where n.nspname not in ('pg_catalog', 'information_schema')
            and n.nspname not like 'pg_toast%'
        ), false) as "canCreateSchemaObjects",
        coalesce((
          select bool_or(has_table_privilege(
            current_user,
            c.oid,
            'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          ))
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where c.relkind in ('r', 'p', 'f')
            and n.nspname not in ('pg_catalog', 'information_schema')
            and n.nspname not like 'pg_toast%'
        ), false) as "canWriteTables"
      from pg_roles r
      where r.rolname = current_user
    `);
      const privileges = result.rows[0];
      if (
        !privileges ||
        privileges.rolsuper ||
        privileges.rolcreaterole ||
        privileges.rolcreatedb ||
        privileges.rolreplication ||
        privileges.rolbypassrls ||
        privileges.canCreateDatabaseObjects ||
        privileges.canCreateSchemaObjects ||
        privileges.canWriteTables
      ) {
        throw new Error("postgres_connection_not_read_only");
      }
    } catch (error) {
      const key = hash(connectionUrl);
      const entry = this.pools.get(key);
      this.pools.delete(key);
      if (entry) await entry.pool.end().catch(() => undefined);
      throw error;
    }
  }

  async getSchema(userId: string, connectionUrl: string): Promise<PostgresIntrospectedSchema> {
    const cacheKey = `${userId}:${hash(connectionUrl)}`;
    const cached = this.schemaCache.get(cacheKey);
    if (cached && Date.now() - cached.at < env.CONNECTOR_SCHEMA_CACHE_TTL_MS) {
      return cached.schema;
    }

    const pool = this.poolFor(connectionUrl);
    const result = await pool.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `
      select table_schema, table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema not in ('pg_catalog', 'information_schema')
        and table_schema not like 'pg_toast%'
      order by table_schema, table_name, ordinal_position
      `,
    );

    const tables = new Map<string, IntrospectedTable>();
    for (const row of result.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const table = tables.get(key) ?? {
        schema: row.table_schema,
        name: row.table_name,
        columns: [],
      };
      table.columns.push({
        name: row.column_name,
        dataType: row.data_type,
        nullable: row.is_nullable === "YES",
      });
      tables.set(key, table);
    }

    const schema: PostgresIntrospectedSchema = { tables: [...tables.values()] };
    evictOldestCacheEntry(this.schemaCache, MAX_SCHEMA_CACHE_ENTRIES);
    this.schemaCache.set(cacheKey, { at: Date.now(), schema });
    return schema;
  }

  async runReadOnlyQuery(
    connectionUrl: string,
    sql: string,
    params: unknown[] = [],
    schema?: PostgresIntrospectedSchema,
  ): Promise<{ rows: unknown[] }> {
    const guard = validateReadOnlySql(sql);
    if (!guard.safe) {
      throw new Error(`sql_rejected:${guard.reason}`);
    }

    if (schema) {
      const schemaCheck = validateAgainstSchema(guard.sql, schema);
      if (!schemaCheck.ok) {
        throw new Error(`sql_rejected:${schemaCheck.reason}`);
      }
    }

    const pool = this.poolFor(connectionUrl);
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(`SET statement_timeout = ${env.CONNECTOR_QUERY_TIMEOUT_MS}`);
      const result = await client.query(guard.sql, params);
      await client.query("COMMIT");
      return { rows: result.rows };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map(({ pool }) => pool.end()));
  }

  private poolFor(connectionUrl: string): Pool {
    const key = hash(connectionUrl);
    const existing = this.pools.get(key);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing.pool;
    }

    if (this.pools.size >= MAX_POOLS) {
      const oldest = [...this.pools.entries()].sort(
        (left, right) => left[1].lastUsedAt - right[1].lastUsedAt,
      )[0];
      if (oldest) {
        this.pools.delete(oldest[0]);
        void oldest[1].pool.end().catch(() => undefined);
      }
    }

    const pool = new Pool({
      connectionString: connectionUrl,
      max: 3,
      connectionTimeoutMillis: env.CONNECTOR_QUERY_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      statement_timeout: env.CONNECTOR_QUERY_TIMEOUT_MS,
      query_timeout: env.CONNECTOR_QUERY_TIMEOUT_MS + 1_000,
      allowExitOnIdle: true,
    });
    this.pools.set(key, { pool, lastUsedAt: Date.now() });
    return pool;
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function evictOldestCacheEntry<T extends { at: number }>(cache: Map<string, T>, max: number) {
  if (cache.size < max) return;
  const oldest = [...cache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
  if (oldest) cache.delete(oldest[0]);
}

function assertPostgresUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("invalid_postgres_connection_url");
  }
  if ((parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") || !parsed.hostname) {
    throw new Error("invalid_postgres_connection_url");
  }
  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error("invalid_postgres_connection_url:database_required");
  }
}
