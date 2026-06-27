import { env } from "@heyriz/shared/env";
import type { PostgresIntrospectedSchema } from "./postgres-introspection.service";

export type SqlGuardResult = { safe: true; sql: string } | { safe: false; reason: string };
export type SchemaCheckResult = { ok: true } | { ok: false; reason: string };

const FORBIDDEN_KEYWORD =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY|CALL|EXECUTE|VACUUM|REINDEX|CREATE|MERGE|INTO)\b/i;
const STARTS_WITH_SELECT = /^\s*(WITH\b[\s\S]*?)?SELECT\b/i;
const HAS_LIMIT = /\bLIMIT\s+(\d+)\b/i;

/**
 * Validates that LLM-generated SQL is a single read-only SELECT before it
 * ever reaches a real connection. This is a pre-filter, not the only line of
 * defense — the caller must still execute inside a read-only transaction
 * (BEGIN READ ONLY) so the database itself refuses a write even if a future
 * SQL keyword slips past this regex.
 */
export function validateReadOnlySql(rawSql: string, options?: { maxRows?: number }): SqlGuardResult {
  const maxRows = options?.maxRows ?? env.CONNECTOR_SQL_ROW_LIMIT;
  let sql = rawSql.trim().replace(/;\s*$/, "");

  if (/;\s*\S/.test(sql)) {
    return { safe: false, reason: "multiple_statements" };
  }
  if (!STARTS_WITH_SELECT.test(sql)) {
    return { safe: false, reason: "not_a_select" };
  }
  const forbidden = sql.match(FORBIDDEN_KEYWORD);
  if (forbidden) {
    return { safe: false, reason: `forbidden_keyword:${forbidden[1].toUpperCase()}` };
  }

  const limitMatch = sql.match(HAS_LIMIT);
  if (!limitMatch) {
    sql = `${sql} LIMIT ${maxRows}`;
  } else if (Number(limitMatch[1]) > maxRows) {
    sql = sql.replace(HAS_LIMIT, `LIMIT ${maxRows}`);
  }

  return { safe: true, sql };
}

const FROM_OR_JOIN_TABLE = /\b(?:FROM|JOIN)\s+"?([a-zA-Z_][\w]*)"?(?:\s+(?:AS\s+)?"?([a-zA-Z_][\w]*)"?)?/gi;
const QUALIFIED_COLUMN = /\b([a-zA-Z_][\w]*)\."?([a-zA-Z_][\w]*)"?/g;
// Bare identifiers that follow a table/alias reference, not a column — never flag these as unknown columns.
const RESERVED_AFTER_ALIAS = new Set(["ON", "WHERE", "SET", "GROUP", "ORDER", "USING"]);

/**
 * Best-effort catch for an LLM hallucinating a table that doesn't exist, or a
 * qualified column (table.column / alias.column) that doesn't belong to that
 * table — before the query ever reaches the database. Deliberately narrow:
 * unqualified columns and expressions are left alone (too ambiguous to check
 * by regex without a real SQL parser), so this only rejects the unambiguous
 * cases, never a valid query.
 */
export function validateAgainstSchema(
  sql: string,
  schema: PostgresIntrospectedSchema,
): SchemaCheckResult {
  const tablesByName = new Map(schema.tables.map((t) => [t.name.toLowerCase(), t]));
  if (tablesByName.size === 0) return { ok: true }; // no introspected schema to check against

  // alias/table-name -> real table, so "o" in "FROM orders o" resolves to "orders".
  const aliasToTable = new Map<string, string>();

  let match: RegExpExecArray | null;
  FROM_OR_JOIN_TABLE.lastIndex = 0;
  while ((match = FROM_OR_JOIN_TABLE.exec(sql))) {
    const [, tableName, alias] = match;
    const table = tablesByName.get(tableName.toLowerCase());
    if (!table) {
      return { ok: false, reason: `unknown_table:${tableName}` };
    }
    aliasToTable.set(tableName.toLowerCase(), table.name);
    if (alias && !RESERVED_AFTER_ALIAS.has(alias.toUpperCase())) {
      aliasToTable.set(alias.toLowerCase(), table.name);
    }
  }

  QUALIFIED_COLUMN.lastIndex = 0;
  while ((match = QUALIFIED_COLUMN.exec(sql))) {
    const [, qualifier, column] = match;
    const tableName = aliasToTable.get(qualifier.toLowerCase());
    if (!tableName) continue; // qualifier isn't a known alias/table — not ours to judge (e.g. a schema name)
    const table = tablesByName.get(tableName.toLowerCase());
    if (table && !table.columns.some((c) => c.name.toLowerCase() === column.toLowerCase())) {
      return { ok: false, reason: `unknown_column:${qualifier}.${column}` };
    }
  }

  return { ok: true };
}
