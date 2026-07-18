import { parse, toSql, type SelectFromStatement, type Statement } from "pgsql-ast-parser";
import { env } from "@heyriz/shared/env";
import type {
  IntrospectedTable,
  PostgresIntrospectedSchema,
} from "./postgres-introspection.service";

export type SqlGuardResult = { safe: true; sql: string } | { safe: false; reason: string };
export type SchemaCheckResult = { ok: true } | { ok: false; reason: string };

const SAFE_FUNCTIONS = new Set([
  "abs",
  "avg",
  "ceil",
  "ceiling",
  "char_length",
  "coalesce",
  "count",
  "current_date",
  "date_part",
  "date_trunc",
  "extract",
  "floor",
  "greatest",
  "json_agg",
  "jsonb_agg",
  "least",
  "length",
  "lower",
  "make_interval",
  "max",
  "min",
  "now",
  "nullif",
  "percentile_cont",
  "percentile_disc",
  "round",
  "sum",
  "timezone",
  "to_char",
  "upper",
]);

/**
 * Parses LLM-generated SQL and accepts exactly one read-only SELECT tree. The
 * database transaction remains the final write barrier, while the AST check
 * rejects stacked statements, data-changing CTEs, row locks and functions with
 * unknown side effects before the query reaches PostgreSQL.
 */
export function validateReadOnlySql(
  rawSql: string,
  options?: { maxRows?: number },
): SqlGuardResult {
  const maxRows = options?.maxRows ?? env.CONNECTOR_SQL_ROW_LIMIT;
  let statements: Statement[];
  try {
    statements = parse(rawSql.trim());
  } catch {
    return { safe: false, reason: "parse_error" };
  }

  if (statements.length !== 1) return { safe: false, reason: "multiple_statements" };
  const statement = statements[0];
  const selectCheck = validateSelectTree(statement);
  if (selectCheck) return { safe: false, reason: selectCheck };

  const functionCheck = validateFunctions(statement);
  if (functionCheck) return { safe: false, reason: functionCheck };

  const outer = outerSelect(statement);
  if (!outer) return { safe: false, reason: "unsupported_select_shape" };
  const limitCheck = normalizeLimit(outer, maxRows);
  if (limitCheck) return { safe: false, reason: limitCheck };

  return { safe: true, sql: toSql.statement(statement) };
}

/**
 * Validates real table and qualified-column references against introspection.
 * CTEs and subquery aliases are treated as virtual tables, fixing the previous
 * regex guard that rejected valid `WITH recent AS (...) SELECT ... FROM recent`.
 */
export function validateAgainstSchema(
  sql: string,
  schema: PostgresIntrospectedSchema,
): SchemaCheckResult {
  if (schema.tables.length === 0) return { ok: false, reason: "empty_schema" };

  let statement: Statement;
  try {
    const statements = parse(sql);
    if (statements.length !== 1) return { ok: false, reason: "multiple_statements" };
    statement = statements[0];
  } catch {
    return { ok: false, reason: "parse_error" };
  }

  const ctes = new Set<string>();
  const virtualAliases = new Set<string>();
  const aliases = new Map<string, IntrospectedTable>();
  collectVirtualNames(statement, ctes, virtualAliases);

  let failure: string | undefined;
  walk(statement, (node) => {
    if (failure || node.type !== "table") return;
    const name = record(node.name);
    const tableName = stringValue(name.name);
    if (!tableName || ctes.has(tableName.toLowerCase())) return;
    const schemaName = stringValue(name.schema);
    const table = resolveTable(schema.tables, schemaName, tableName);
    if (!table) {
      failure = `unknown_table:${schemaName ? `${schemaName}.` : ""}${tableName}`;
      return;
    }
    aliases.set(tableName.toLowerCase(), table);
    const alias = stringValue(name.alias);
    if (alias) aliases.set(alias.toLowerCase(), table);
  });
  if (failure) return { ok: false, reason: failure };

  walk(statement, (node) => {
    if (failure || node.type !== "ref") return;
    const table = record(node.table);
    const qualifier = stringValue(table.name);
    const column = stringValue(node.name);
    if (!qualifier || !column || column === "*") return;
    if (ctes.has(qualifier.toLowerCase()) || virtualAliases.has(qualifier.toLowerCase())) return;
    const resolved = aliases.get(qualifier.toLowerCase());
    if (!resolved) {
      failure = `unknown_qualifier:${qualifier}`;
      return;
    }
    if (!resolved.columns.some((candidate) => candidate.name.toLowerCase() === column.toLowerCase())) {
      failure = `unknown_column:${qualifier}.${column}`;
    }
  });

  return failure ? { ok: false, reason: failure } : { ok: true };
}

function validateSelectTree(statement: Statement): string | undefined {
  if (statement.type === "select") {
    if (statement.for) return "row_lock_not_allowed";
    return undefined;
  }
  if (statement.type === "with") {
    for (const binding of statement.bind) {
      const invalid = validateSelectTree(binding.statement as Statement);
      if (invalid) return invalid;
    }
    return validateSelectTree(statement.in as Statement);
  }
  // Recursive CTEs, UNIONs and VALUES are unnecessary for the business-metric
  // path and complicate deterministic row bounding, so they fail closed.
  return `not_a_select:${statement.type}`;
}

function validateFunctions(statement: Statement): string | undefined {
  let unsafe: string | undefined;
  walk(statement, (node) => {
    if (unsafe || node.type !== "call") return;
    const fn = record(node.function);
    const name = stringValue(fn.name)?.toLowerCase();
    const schema = stringValue(fn.schema)?.toLowerCase();
    if (!name || schema || !SAFE_FUNCTIONS.has(name)) {
      unsafe = `function_not_allowed:${schema ? `${schema}.` : ""}${name ?? "unknown"}`;
    }
  });
  return unsafe;
}

function outerSelect(statement: Statement): SelectFromStatement | undefined {
  if (statement.type === "select") return statement;
  if (statement.type === "with") return outerSelect(statement.in as Statement);
  return undefined;
}

function normalizeLimit(statement: SelectFromStatement, maxRows: number): string | undefined {
  const limit = statement.limit?.limit;
  if (!limit) {
    statement.limit = { limit: { type: "integer", value: maxRows } };
    return undefined;
  }
  if (limit.type !== "integer" || !Number.isInteger(limit.value) || limit.value <= 0) {
    return "invalid_limit";
  }
  if (limit.value > maxRows) limit.value = maxRows;
  return undefined;
}

function collectVirtualNames(
  statement: Statement,
  ctes: Set<string>,
  virtualAliases: Set<string>,
) {
  walk(statement, (node) => {
    if (node.type === "with" && Array.isArray(node.bind)) {
      for (const binding of node.bind) {
        const alias = stringValue(record(record(binding).alias).name);
        if (alias) ctes.add(alias.toLowerCase());
      }
    }
    if (node.type === "statement") {
      const alias = stringValue(node.alias);
      if (alias) virtualAliases.add(alias.toLowerCase());
    }
  });
}

function resolveTable(
  tables: IntrospectedTable[],
  schemaName: string | undefined,
  tableName: string,
): IntrospectedTable | undefined {
  const matches = tables.filter((table) =>
    table.name.toLowerCase() === tableName.toLowerCase() &&
    (!schemaName || (table.schema ?? "public").toLowerCase() === schemaName.toLowerCase()),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  const node = value as Record<string, unknown>;
  visit(node);
  for (const child of Object.values(node)) walk(child, visit);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
