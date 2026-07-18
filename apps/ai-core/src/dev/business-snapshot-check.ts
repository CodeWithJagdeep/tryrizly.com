import "reflect-metadata";
import { env } from "@heyriz/shared/env";

const TEST_DATABASE_URL =
  process.env.BUSINESS_SNAPSHOT_TEST_DATABASE_URL
  ?? "postgres://heyriz:heyriz@localhost:5434/heyriz";
const TEST_MONGO_URL =
  process.env.BUSINESS_SNAPSHOT_TEST_MONGO_URL
  ?? "mongodb://heyriz:heyriz@localhost:27019/heyriz?authSource=admin";
const ALLOW_SKIP = process.env.BUSINESS_SNAPSHOT_ALLOW_SKIP === "true";

async function main() {
  const checks: Array<[string, boolean]> = [];
  const unavailable: string[] = [];
  await checkPostgres(checks, unavailable);
  await checkMongo(checks, unavailable);

  if (unavailable.length > 0) {
    for (const source of unavailable) {
      checks.push([
        `${source} live check is reachable or explicitly skippable`,
        ALLOW_SKIP,
      ]);
    }
  }

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  if (unavailable.length > 0 && ALLOW_SKIP) {
    console.log(`SKIP  unavailable live sources: ${unavailable.join(", ")}`);
  }
  console.log(ok ? "BUSINESS_SNAPSHOT_CHECK_OK" : "BUSINESS_SNAPSHOT_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

async function checkPostgres(
  checks: Array<[string, boolean]>,
  unavailable: string[],
) {
  const { PostgresIntrospectionService } = await import(
    "../connectors/postgres-introspection.service"
  );
  const postgres = new PostgresIntrospectionService();
  try {
    let schema;
    try {
      schema = await postgres.getSchema("smoke-test", TEST_DATABASE_URL);
      checks.push(["Postgres schema introspection completes", Array.isArray(schema.tables)]);
      console.log(
        "Introspected Postgres tables:",
        schema.tables.map((table) =>
          `${table.schema ?? "public"}.${table.name}(${table.columns.length} cols)`
        ).join(", ") || "(empty database)",
      );
    } catch (error) {
      unavailable.push("Postgres");
      console.log(
        "POSTGRES_UNAVAILABLE",
        redactConnectionUrl(TEST_DATABASE_URL),
        safeSmokeError(error),
      );
      return;
    }

    const handWritten = await postgres.runReadOnlyQuery(
      TEST_DATABASE_URL,
      "SELECT 1 AS ok",
    );
    checks.push([
      "Postgres read-only SELECT executes",
      (handWritten.rows[0] as { ok?: number } | undefined)?.ok === 1,
    ]);

    try {
      await postgres.runReadOnlyQuery(TEST_DATABASE_URL, "DROP TABLE connected_accounts");
      checks.push(["Postgres destructive SQL is rejected", false]);
    } catch (error) {
      checks.push([
        "Postgres destructive SQL is rejected",
        String(error).includes("sql_rejected"),
      ]);
    }

    if (env.AI_PROVIDER !== "rules" && schema.tables.length > 0) {
      const textToQuery = await textToQueryService();
      const sql = await textToQuery.sqlFor(
        "smoke-test",
        "Return one simple count from a suitable table",
        schema,
      );
      checks.push(["LLM produced candidate Postgres SQL", Boolean(sql)]);
      if (sql) {
        const result = await postgres.runReadOnlyQuery(TEST_DATABASE_URL, sql, [], schema);
        checks.push(["LLM Postgres SQL executes through guards", Array.isArray(result.rows)]);
      }
    } else {
      console.log("POSTGRES_LLM_SKIP", "rules provider or empty schema");
    }
  } finally {
    await postgres.onModuleDestroy();
  }
}

async function checkMongo(
  checks: Array<[string, boolean]>,
  unavailable: string[],
) {
  const { MongoIntrospectionService } = await import(
    "../connectors/mongo-introspection.service"
  );
  const mongo = new MongoIntrospectionService();
  try {
    let schema;
    try {
      schema = await mongo.getSchema("smoke-test", TEST_MONGO_URL);
      checks.push(["MongoDB schema introspection completes", Array.isArray(schema.collections)]);
      console.log(
        "Introspected MongoDB collections:",
        schema.collections.map((collection) =>
          `${collection.name}(${collection.sampledFields.length} fields)`
        ).join(", ") || "(empty database)",
      );
    } catch (error) {
      unavailable.push("MongoDB");
      console.log(
        "MONGODB_UNAVAILABLE",
        redactConnectionUrl(TEST_MONGO_URL),
        safeSmokeError(error),
      );
      return;
    }

    const firstCollection = schema.collections[0];
    if (firstCollection) {
      const result = await mongo.runFind(TEST_MONGO_URL, {
        collection: firstCollection.name,
        filter: {},
        limit: 3,
      }, schema);
      checks.push(["MongoDB bounded find executes", Array.isArray(result.documents)]);

      try {
        await mongo.runQuery(TEST_MONGO_URL, {
          collection: firstCollection.name,
          filter: { $where: "return true" },
        }, schema);
        checks.push(["MongoDB JavaScript filter is rejected", false]);
      } catch (error) {
        checks.push([
          "MongoDB JavaScript filter is rejected",
          String(error).includes("mongo_operator_not_allowed"),
        ]);
      }

      if (env.AI_PROVIDER !== "rules") {
        const textToQuery = await textToQueryService();
        const spec = await textToQuery.mongoSpecFor(
          "smoke-test",
          `Return up to three recent documents from ${firstCollection.name}`,
          schema,
        );
        checks.push(["LLM produced candidate MongoDB query", Boolean(spec)]);
        if (spec) {
          const llmResult = await mongo.runQuery(TEST_MONGO_URL, spec, schema);
          checks.push(["LLM MongoDB query executes through guards", Array.isArray(llmResult.documents)]);
        }
      } else {
        console.log("MONGODB_LLM_SKIP", "rules provider");
      }
    } else {
      console.log("MONGODB_QUERY_SKIP", "empty database has no collection to query");
    }
  } finally {
    await mongo.onModuleDestroy();
  }
}

async function textToQueryService() {
  const { LlmRouterService } = await import("../llm/llm-router.service");
  const { GrokProvider } = await import("../llm/grok.provider");
  const { OpenAiProvider } = await import("../llm/openai.provider");
  const { AnthropicProvider } = await import("../llm/anthropic.provider");
  const { UsageLedgerService } = await import("../llm/usage-ledger.service");
  const { TextToQueryService } = await import("../connectors/text-to-query.service");
  return new TextToQueryService(new LlmRouterService(
    new GrokProvider(),
    new OpenAiProvider(),
    new AnthropicProvider(),
    new UsageLedgerService(),
  ));
}

function redactConnectionUrl(value: string): string {
  return value.replace(/(mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^@/]+@/i, "$1://[credentials]@");
}

function safeSmokeError(error: unknown): string {
  return redactConnectionUrl(error instanceof Error ? error.message : String(error)).slice(0, 500);
}

main().catch((error) => {
  console.error("BUSINESS_SNAPSHOT_CHECK_FAIL", safeSmokeError(error));
  process.exit(1);
});
