import { createHash } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { validateAgainstSchema, validateReadOnlySql } from "./sql-guard";

export type IntrospectedColumn = { name: string; dataType: string; nullable: boolean };
export type IntrospectedTable = { name: string; columns: IntrospectedColumn[] };
export type PostgresIntrospectedSchema = { tables: IntrospectedTable[] };

type CacheEntry = { at: number; schema: PostgresIntrospectedSchema };

/**
 * Talks to a principal's OWN external Postgres database (vault-stored
 * connectionUrl) — distinct from ConnectorRepository's pool, which is
 * heyriz's own app database. One pool per connection string, schema cached
 * in-process since it's cheap to recompute and non-sensitive (names only).
 */
@Injectable()
export class PostgresIntrospectionService implements OnModuleDestroy {
  private readonly pools = new Map<string, Pool>();
  private readonly schemaCache = new Map<string, CacheEntry>();

  async getSchema(userId: string, connectionUrl: string): Promise<PostgresIntrospectedSchema> {
    const cacheKey = `${userId}:${hash(connectionUrl)}`;
    const cached = this.schemaCache.get(cacheKey);
    if (cached && Date.now() - cached.at < env.CONNECTOR_SCHEMA_CACHE_TTL_MS) {
      return cached.schema;
    }

    const pool = this.poolFor(connectionUrl);
    const result = await pool.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
      `,
    );

    const tables = new Map<string, IntrospectedTable>();
    for (const row of result.rows) {
      const table = tables.get(row.table_name) ?? { name: row.table_name, columns: [] };
      table.columns.push({
        name: row.column_name,
        dataType: row.data_type,
        nullable: row.is_nullable === "YES",
      });
      tables.set(row.table_name, table);
    }

    const schema: PostgresIntrospectedSchema = { tables: [...tables.values()] };
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
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
  }

  private poolFor(connectionUrl: string): Pool {
    const key = hash(connectionUrl);
    let pool = this.pools.get(key);
    if (!pool) {
      pool = new Pool({ connectionString: connectionUrl, max: 3 });
      this.pools.set(key, pool);
    }
    return pool;
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
