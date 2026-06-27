import type { ConnectorService } from "../connectors/connector.service";
import type { DataSourceProvider, RazorpayConnectorSecret, StripeConnectorSecret } from "../connectors/connector.types";
import type { MongoIntrospectionService } from "../connectors/mongo-introspection.service";
import type { PostgresIntrospectionService } from "../connectors/postgres-introspection.service";
import type { RazorpayService } from "../connectors/razorpay.service";
import type { StripeService } from "../connectors/stripe.service";
import type { TextToQueryService } from "../connectors/text-to-query.service";
import type { HeyRizTool } from "./tool.types";
import type { ToolExecutionResult } from "./tool.types";

type BusinessSnapshotPayload = {
  question?: string;
  accountId?: string;
};

export function createBusinessSnapshotTool(
  connectors: ConnectorService,
  postgres: PostgresIntrospectionService,
  mongo: MongoIntrospectionService,
  razorpay: RazorpayService,
  stripe: StripeService,
  textToQuery: TextToQueryService,
): HeyRizTool<BusinessSnapshotPayload> {
  return {
    name: "business_snapshot",
    category: "database",
    description:
      "Answer an ad-hoc business question (transactions, signups, MRR, metrics) by querying the principal's connected Postgres, MongoDB, Razorpay, or Stripe account. Needs a question.",
    approvalRequired: false,
    sensitiveDataPolicy: "read_only",
    async execute({ userId, payload, context }) {
      const question = payload.question?.trim();
      if (!question) {
        return {
          tool: "business_snapshot",
          status: "not_implemented",
          message: `What would you like to know, ${context.honorific}?`,
        };
      }

      const allConnected = (await connectors.list(userId)).filter(
        (c) => c.status === "connected" && isDataSourceProvider(c.provider),
      );

      if (allConnected.length === 0) {
        return {
          tool: "business_snapshot",
          status: "needs_connection",
          message: `No business data sources connected yet, ${context.honorific} — add Postgres, MongoDB, or Razorpay in the dashboard.`,
        };
      }

      // If caller specified an accountId (from a prior clarification turn), use it directly.
      if (payload.accountId) {
        const account = allConnected.find((c) => c.id === payload.accountId);
        if (!account) {
          return {
            tool: "business_snapshot",
            status: "not_implemented",
            message: `Couldn't find that database account, ${context.honorific}.`,
          };
        }
        return await answerFromAccount(connectors, postgres, mongo, razorpay, stripe, textToQuery, userId, account.id, account.provider as DataSourceProvider, question, context.honorific);
      }

      // For multi-account DB providers (postgres/mongodb), check if there are multiple accounts.
      const dbProviders = ["postgres", "mongodb"] as const;
      for (const dbProvider of dbProviders) {
        const accounts = allConnected.filter((c) => c.provider === dbProvider);
        if (accounts.length > 1) {
          // Check if keyword guess narrows it to one by label.
          const labelMatch = accounts.find((a) =>
            question.toLowerCase().includes(a.label.toLowerCase()),
          );
          if (labelMatch) {
            return await answerFromAccount(connectors, postgres, mongo, razorpay, stripe, textToQuery, userId, labelMatch.id, dbProvider, question, context.honorific);
          }
          // Ask which account to use.
          const list = accounts.map((a, i) => `${i + 1}. ${a.label}`).join("\n");
          return {
            tool: "business_snapshot",
            status: "ok",
            message: `You have multiple ${dbProvider === "postgres" ? "Postgres" : "MongoDB"} databases connected, ${context.honorific} — which one should I check?\n\n${list}\n\nJust tell me the name and I'll query it.`,
          };
        }
      }

      // Single account per provider — fall through to provider-level logic.
      const connected = [...new Set(allConnected.map((c) => c.provider as DataSourceProvider))];
      const provider =
        connected.length === 1
          ? connected[0]
          : (keywordGuess(question, connected) ??
            (await textToQuery.pickProvider(userId, question, connected)));

      if (!provider) {
        const names = allConnected.map((c) => c.label).join(", ");
        return {
          tool: "business_snapshot",
          status: "ok",
          message: `I've got ${names} connected, ${context.honorific} — which one should I check for that?`,
        };
      }

      const account = allConnected.find((c) => c.provider === provider);
      if (!account) {
        return { tool: "business_snapshot", status: "needs_connection", message: `${provider} isn't connected, ${context.honorific}.` };
      }

      return await answerFromAccount(connectors, postgres, mongo, razorpay, stripe, textToQuery, userId, account.id, provider, question, context.honorific);
    },
  };
}

async function answerFromAccount(
  connectors: ConnectorService,
  postgres: PostgresIntrospectionService,
  mongo: MongoIntrospectionService,
  razorpay: RazorpayService,
  stripe: StripeService,
  textToQuery: TextToQueryService,
  userId: string,
  accountId: string,
  provider: DataSourceProvider,
  question: string,
  honorific: string,
): Promise<ToolExecutionResult> {
  try {
    if (provider === "postgres" || provider === "mongodb") {
      const accounts = await connectors.getAllDataSourceSecrets(userId, provider);
      const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
      if (!account) {
        return { tool: "business_snapshot", status: "needs_connection", message: `${provider} isn't connected, ${honorific}.` };
      }
      if (provider === "postgres") {
        return await answerFromPostgres(postgres, textToQuery, userId, account.connectionUrl, question, honorific);
      }
      return await answerFromMongo(mongo, textToQuery, userId, account.connectionUrl, question, honorific);
    }
    const secretResult = await connectors.getDataSourceSecret(userId, provider);
    if (!secretResult.connected) {
      return { tool: "business_snapshot", status: "needs_connection", message: `${provider} isn't connected, ${honorific}.` };
    }
    if (secretResult.provider === "stripe") {
      return await answerFromStripe(stripe, textToQuery, userId, secretResult.secret, question, honorific);
    }
    if (secretResult.provider !== "razorpay") {
      return { tool: "business_snapshot", status: "not_implemented", message: `Unexpected provider, ${honorific}.` };
    }
    return await answerFromRazorpay(razorpay, textToQuery, userId, secretResult.secret, question, honorific);
  } catch (error) {
    return {
      tool: "business_snapshot",
      status: "not_implemented",
      message: `Couldn't get an answer from ${provider} just now, ${honorific} — ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isDataSourceProvider(provider: string): provider is DataSourceProvider {
  return provider === "postgres" || provider === "mongodb" || provider === "razorpay" || provider === "stripe";
}

function keywordGuess(
  question: string,
  providers: DataSourceProvider[],
): DataSourceProvider | undefined {
  const lower = question.toLowerCase();
  if (
    providers.includes("stripe") &&
    /(stripe|charge|payment_intent|invoice|subscription|customer)/.test(lower)
  ) {
    return "stripe";
  }
  if (
    providers.includes("razorpay") &&
    /(razorpay|payment|transaction|refund|settlement|revenue|mrr|order)/.test(lower)
  ) {
    return "razorpay";
  }
  if (/(signup|user|row|table|record|count)/.test(lower)) {
    return providers.includes("postgres") ? "postgres" : providers.includes("mongodb") ? "mongodb" : undefined;
  }
  return undefined;
}

async function answerFromPostgres(
  postgres: PostgresIntrospectionService,
  textToQuery: TextToQueryService,
  userId: string,
  connectionUrl: string,
  question: string,
  honorific: string,
): Promise<ToolExecutionResult> {
  const schema = await postgres.getSchema(userId, connectionUrl);
  const sql = await textToQuery.sqlFor(userId, question, schema);
  if (!sql) {
    return {
      tool: "business_snapshot",
      status: "not_implemented",
      message: `Couldn't turn that into a query against your database, ${honorific}.`,
    };
  }

  const { rows } = await postgres.runReadOnlyQuery(connectionUrl, sql, [], schema);
  return {
    tool: "business_snapshot",
    status: "ok",
    message: summarizeRows(rows, honorific),
    data: { provider: "postgres", rows },
  };
}

async function answerFromMongo(
  mongo: MongoIntrospectionService,
  textToQuery: TextToQueryService,
  userId: string,
  connectionUrl: string,
  question: string,
  honorific: string,
): Promise<ToolExecutionResult> {
  const schema = await mongo.getSchema(userId, connectionUrl);
  const spec = await textToQuery.mongoSpecFor(userId, question, schema);
  if (!spec) {
    return {
      tool: "business_snapshot",
      status: "not_implemented",
      message: `Couldn't turn that into a query against your database, ${honorific}.`,
    };
  }

  const { documents } = await mongo.runFind(connectionUrl, spec);
  return {
    tool: "business_snapshot",
    status: "ok",
    message: summarizeRows(documents, honorific),
    data: { provider: "mongodb", documents },
  };
}

async function answerFromStripe(
  stripe: StripeService,
  textToQuery: TextToQueryService,
  userId: string,
  secret: StripeConnectorSecret,
  question: string,
  honorific: string,
): Promise<ToolExecutionResult> {
  const endpoint = await textToQuery.pickStripeEndpoint(userId, question);
  const { data } = await stripe.fetch(secret, endpoint, { limit: 20 });
  return {
    tool: "business_snapshot",
    status: "ok",
    message: `Found ${data.length} ${endpoint} record${data.length === 1 ? "" : "s"} from Stripe, ${honorific}.`,
    data: { provider: "stripe", endpoint, items: data },
  };
}

async function answerFromRazorpay(
  razorpay: RazorpayService,
  textToQuery: TextToQueryService,
  userId: string,
  secret: RazorpayConnectorSecret,
  question: string,
  honorific: string,
): Promise<ToolExecutionResult> {
  const endpoint = await textToQuery.pickRazorpayEndpoint(userId, question);
  const { items } = await razorpay.fetch(secret, endpoint, { count: 20 });
  return {
    tool: "business_snapshot",
    status: "ok",
    message: `Found ${items.length} ${endpoint} record${items.length === 1 ? "" : "s"} from Razorpay, ${honorific}.`,
    data: { provider: "razorpay", endpoint, items },
  };
}

function summarizeRows(rows: unknown[], honorific: string): string {
  if (rows.length === 0) return `No results for that, ${honorific}.`;
  return `Found ${rows.length} row${rows.length === 1 ? "" : "s"}, ${honorific}. First: ${JSON.stringify(rows[0]).slice(0, 300)}`;
}
