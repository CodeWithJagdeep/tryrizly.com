import { Inject, Injectable } from "@nestjs/common";
import { LlmRouterService, extractJson } from "../llm/llm-router.service";
import type { DataSourceProvider } from "./connector.types";
import type { MongoIntrospectedSchema, MongoQuerySpec } from "./mongo-introspection.service";
import type { PostgresIntrospectedSchema } from "./postgres-introspection.service";
import type { RazorpayEndpoint } from "./razorpay.service";
import type { StripeEndpoint } from "./stripe.service";

const RAZORPAY_ENDPOINTS: RazorpayEndpoint[] = ["payments", "orders", "settlements", "refunds"];
const STRIPE_ENDPOINTS: StripeEndpoint[] = ["charges", "payment_intents", "customers", "subscriptions", "invoices", "balance_transactions"];

/**
 * Turns a natural-language business question into one read-only query.
 * Returns undefined on any failure (no provider, bad output) so the caller
 * degrades gracefully instead of crashing the turn — the actual safety
 * enforcement lives in sql-guard.ts / MongoIntrospectionService's filter
 * check, not here; this only produces a candidate query.
 */
@Injectable()
export class TextToQueryService {
  constructor(
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
  ) {}

  async sqlFor(
    userId: string,
    question: string,
    schema: PostgresIntrospectedSchema,
  ): Promise<string | undefined> {
    if (!this.llm.hasProvider()) return undefined;

    const schemaText = schema.tables
      .map((t) => `${t.name}(${t.columns.map((c) => `${c.name}: ${c.dataType}`).join(", ")})`)
      .join("\n");

    const raw = await this.llm.complete({
      task: "query",
      userId,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You write a single read-only Postgres SELECT statement to answer the question.",
            "Output ONLY the SQL. No markdown, no explanation, no semicolon-separated statements.",
            "You may use WITH/CTEs. Never use INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/COPY/CALL/MERGE.",
            "Schema:",
            schemaText || "(no tables found)",
          ].join("\n"),
        },
        { role: "user", content: question },
      ],
    });

    return raw ? stripSqlFence(raw) : undefined;
  }

  async mongoSpecFor(
    userId: string,
    question: string,
    schema: MongoIntrospectedSchema,
  ): Promise<MongoQuerySpec | undefined> {
    if (!this.llm.hasProvider()) return undefined;

    const schemaText = schema.collections
      .map(
        (c) =>
          `${c.name}(${c.sampledFields.map((f) => `${f.name}: ${f.types.join("|")}`).join(", ")})`,
      )
      .join("\n");

    const raw = await this.llm.complete({
      task: "query",
      userId,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            'Output ONLY JSON of this exact shape: {"collection":"...","filter":{...},"projection":{...},"sort":{...},"limit":50}.',
            "filter may only use standard query operators ($eq,$gt,$gte,$lt,$lte,$in,$ne,$regex,$and,$or). Never use $where or $function.",
            "Collections (sampled fields):",
            schemaText || "(no collections found)",
          ].join("\n"),
        },
        { role: "user", content: question },
      ],
    });

    return raw ? extractJson<MongoQuerySpec>(raw) : undefined;
  }

  /** Used only when more than one data source is connected and a keyword guess didn't land. */
  async pickProvider(
    userId: string,
    question: string,
    providers: DataSourceProvider[],
  ): Promise<DataSourceProvider | undefined> {
    if (!this.llm.hasProvider()) return undefined;

    const raw = await this.llm.complete({
      task: "query",
      userId,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Which connected source is most likely relevant to the question? Options: ${providers.join(", ")}. Reply with ONLY JSON: {"provider":"<one option, or \\"ambiguous\\">"}.`,
        },
        { role: "user", content: question },
      ],
    });
    const parsed = raw ? extractJson<{ provider?: string }>(raw) : undefined;
    return providers.find((p) => p === parsed?.provider);
  }

  async pickRazorpayEndpoint(userId: string, question: string): Promise<RazorpayEndpoint> {
    if (!this.llm.hasProvider()) return "payments";

    const raw = await this.llm.complete({
      task: "query",
      userId,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'Pick the single most relevant Razorpay endpoint for this question. Reply with ONLY JSON: {"endpoint":"payments|orders|settlements|refunds"}.',
        },
        { role: "user", content: question },
      ],
    });
    const parsed = raw ? extractJson<{ endpoint?: string }>(raw) : undefined;
    return RAZORPAY_ENDPOINTS.find((e) => e === parsed?.endpoint) ?? "payments";
  }

  async pickStripeEndpoint(userId: string, question: string): Promise<StripeEndpoint> {
    if (!this.llm.hasProvider()) return "charges";

    const raw = await this.llm.complete({
      task: "query",
      userId,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'Pick the single most relevant Stripe endpoint for this question. Reply with ONLY JSON: {"endpoint":"charges|payment_intents|customers|subscriptions|invoices|balance_transactions"}.',
        },
        { role: "user", content: question },
      ],
    });
    const parsed = raw ? extractJson<{ endpoint?: string }>(raw) : undefined;
    return STRIPE_ENDPOINTS.find((e) => e === parsed?.endpoint) ?? "charges";
  }
}

function stripSqlFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```sql\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}
