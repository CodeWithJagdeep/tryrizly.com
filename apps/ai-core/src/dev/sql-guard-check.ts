import { validateAgainstSchema, validateReadOnlySql } from "../connectors/sql-guard";
import type { PostgresIntrospectedSchema } from "../connectors/postgres-introspection.service";

const SCHEMA: PostgresIntrospectedSchema = {
  tables: [
    {
      name: "orders",
      columns: [
        { name: "id", dataType: "integer", nullable: false },
        { name: "status", dataType: "text", nullable: false },
        { name: "created_at", dataType: "timestamptz", nullable: false },
      ],
    },
    {
      name: "users",
      columns: [
        { name: "id", dataType: "integer", nullable: false },
        { name: "email", dataType: "text", nullable: false },
      ],
    },
  ],
};

async function main() {
  const checks: Array<[string, boolean]> = [];

  // Safe: a plain SELECT gets a LIMIT injected.
  {
    const r = validateReadOnlySql("SELECT * FROM orders WHERE status = 'paid'");
    checks.push(["plain select -> safe, limit injected", r.safe === true && /LIMIT 500/i.test(r.sql)]);
  }

  // Safe: an existing LIMIT under the cap is left alone.
  {
    const r = validateReadOnlySql("SELECT id FROM orders LIMIT 10");
    checks.push(["existing small limit -> kept", r.safe === true && /LIMIT 10\b/i.test(r.sql) && !/LIMIT 500/i.test(r.sql)]);
  }

  // Safe: an oversized LIMIT is clamped down to the cap.
  {
    const r = validateReadOnlySql("SELECT id FROM orders LIMIT 999999");
    checks.push(["oversized limit -> clamped", r.safe === true && /LIMIT 500\b/i.test(r.sql) && !/999999/.test(r.sql)]);
  }

  // Safe: a CTE (WITH ... SELECT) is allowed.
  {
    const r = validateReadOnlySql("WITH recent AS (SELECT * FROM orders WHERE created_at > now() - interval '1 day') SELECT count(*) FROM recent");
    checks.push(["WITH cte select -> safe", r.safe === true]);
  }

  // Adversarial: stacked statements via a bare `;`.
  {
    const r = validateReadOnlySql("SELECT * FROM orders; DROP TABLE orders");
    checks.push(["stacked statements -> rejected", r.safe === false && r.reason === "multiple_statements"]);
  }

  // Adversarial: not a SELECT at all.
  {
    const r = validateReadOnlySql("DELETE FROM orders WHERE id = 1");
    checks.push(["bare delete -> rejected", r.safe === false && r.reason === "not_a_select"]);
  }

  // Adversarial: a write hidden inside a CTE, with the outer statement looking like a read.
  {
    const r = validateReadOnlySql("WITH x AS (DELETE FROM orders RETURNING *) SELECT * FROM x");
    checks.push(["delete hidden in CTE -> rejected", r.safe === false && r.reason === "forbidden_keyword:DELETE"]);
  }

  // Adversarial: SELECT ... INTO creates a table as a side effect.
  {
    const r = validateReadOnlySql("SELECT * INTO new_table FROM orders");
    checks.push(["select into -> rejected", r.safe === false && r.reason === "forbidden_keyword:INTO"]);
  }

  // Adversarial: a write keyword appearing case-insensitively/mixed case.
  {
    const r = validateReadOnlySql("SeLeCt * FROM orders; uPdAtE orders SET status = 'x'");
    checks.push(["mixed-case stacked update -> rejected", r.safe === false]);
  }

  // Schema check: a real table/qualified column passes.
  {
    const r = validateAgainstSchema("SELECT o.status FROM orders o WHERE o.id = 1", SCHEMA);
    checks.push(["real table + qualified column -> ok", r.ok === true]);
  }

  // Schema check: a hallucinated table is rejected.
  {
    const r = validateAgainstSchema("SELECT * FROM signups", SCHEMA);
    checks.push(["hallucinated table -> rejected", r.ok === false && r.reason === "unknown_table:signups"]);
  }

  // Schema check: a hallucinated qualified column on a real table is rejected.
  {
    const r = validateAgainstSchema("SELECT o.total_amount FROM orders o", SCHEMA);
    checks.push([
      "hallucinated qualified column -> rejected",
      r.ok === false && r.reason === "unknown_column:o.total_amount",
    ]);
  }

  // Schema check: unqualified columns and aggregates are never flagged (too ambiguous to check safely).
  {
    const r = validateAgainstSchema("SELECT count(*), status FROM orders", SCHEMA);
    checks.push(["unqualified column/aggregate -> left alone", r.ok === true]);
  }

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "SQL_GUARD_CHECK_OK" : "SQL_GUARD_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("SQL_GUARD_CHECK_FAIL", e);
  process.exit(1);
});
