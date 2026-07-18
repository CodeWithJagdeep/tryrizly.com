import { describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({
  env: { CONNECTOR_SQL_ROW_LIMIT: 500 },
}));

import { validateAgainstSchema, validateReadOnlySql } from "./sql-guard";
import type { PostgresIntrospectedSchema } from "./postgres-introspection.service";

const schema: PostgresIntrospectedSchema = {
  tables: [
    {
      schema: "public",
      name: "orders",
      columns: [
        { name: "id", dataType: "integer", nullable: false },
        { name: "status", dataType: "text", nullable: false },
        { name: "created_at", dataType: "timestamptz", nullable: false },
      ],
    },
    {
      schema: "analytics",
      name: "events",
      columns: [{ name: "kind", dataType: "text", nullable: false }],
    },
  ],
};

describe("SQL guard", () => {
  it("injects and clamps a structural row limit", () => {
    expect(validateReadOnlySql("select * from orders", { maxRows: 20 })).toMatchObject({
      safe: true,
    });
    const result = validateReadOnlySql("select * from orders limit 999", { maxRows: 20 });
    expect(result.safe && result.sql).toMatch(/LIMIT\s*\(20\)/i);
  });

  it.each([
    "delete from orders",
    "select * from orders; drop table orders",
    "with gone as (delete from orders returning *) select * from gone",
    "select * from orders for update",
    "select pg_sleep(10)",
    "select * into copied_orders from orders",
    "select 1 union select 2",
  ])("rejects unsafe SQL: %s", (sql) => {
    expect(validateReadOnlySql(sql).safe).toBe(false);
  });

  it("accepts a read-only CTE and validates its real source table", () => {
    const sql = "with recent as (select * from public.orders) select count(*) from recent";
    const guard = validateReadOnlySql(sql);
    expect(guard.safe).toBe(true);
    expect(validateAgainstSchema(sql, schema)).toEqual({ ok: true });
  });

  it("validates schema-qualified tables and qualified columns", () => {
    expect(
      validateAgainstSchema("select e.kind from analytics.events e", schema),
    ).toEqual({ ok: true });
    expect(
      validateAgainstSchema("select e.missing from analytics.events e", schema),
    ).toEqual({ ok: false, reason: "unknown_column:e.missing" });
  });
});
