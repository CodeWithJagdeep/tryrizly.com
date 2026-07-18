import { logger } from "@heyriz/shared/logger";
import { sanitizeDatabaseRows } from "../connectors/database-output";
import type { ConnectorService } from "../connectors/connector.service";
import type {
  DataSourceProvider,
  RazorpayConnectorSecret,
  StripeConnectorSecret,
} from "../connectors/connector.types";
import type { MongoIntrospectionService } from "../connectors/mongo-introspection.service";
import type { PostgresIntrospectionService } from "../connectors/postgres-introspection.service";
import type { RazorpayService } from "../connectors/razorpay.service";
import type { StripeService } from "../connectors/stripe.service";
import type { TextToQueryService } from "../connectors/text-to-query.service";
import { connectorSetupUrl } from "./connector-links";
import type { HeyRizTool, ToolExecutionResult } from "./tool.types";

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
      "Answer an ad-hoc business question (transactions, signups, MRR, metrics) by querying the principal's connected Postgres, MongoDB, Razorpay, or Stripe account. Call this immediately for any business-data request, even a vague one like 'check razorpay'. Omitting the question returns a default overview of recent activity.",
    approvalRequired: false,
    sensitiveDataPolicy: "read_only",
    async execute({ userId, payload, context }) {
      const question = payload.question?.trim() || "Overview of recent payments and transactions";
      const allConnected = (await connectors.list(userId)).filter(
        (account) => account.status === "connected" && isDataSourceProvider(account.provider),
      );

      if (allConnected.length === 0) {
        return {
          tool: "business_snapshot",
          status: "needs_connection",
          message: dataConnectionMessage(context.honorific),
        };
      }

      if (payload.accountId) {
        const account = allConnected.find((candidate) => candidate.id === payload.accountId);
        if (!account) {
          return {
            tool: "business_snapshot",
            status: "invalid_input",
            message: `Couldn't find that connected account, ${context.honorific}.`,
          };
        }
        return answerFromAccount(
          connectors,
          postgres,
          mongo,
          razorpay,
          stripe,
          textToQuery,
          userId,
          account.id,
          account.provider as DataSourceProvider,
          question,
          context.honorific,
        );
      }

      const normalizedQuestion = question.toLowerCase();
      const labelMatches = allConnected
        .filter((account) =>
          account.label.length >= 3 && normalizedQuestion.includes(account.label.toLowerCase()),
        )
        .sort((left, right) => right.label.length - left.label.length);
      const labelMatch = labelMatches[0]
        && labelMatches[0].label.length > (labelMatches[1]?.label.length ?? 0)
        ? labelMatches[0]
        : labelMatches.length === 1
          ? labelMatches[0]
          : undefined;
      if (labelMatch) {
        return answerFromAccount(
          connectors,
          postgres,
          mongo,
          razorpay,
          stripe,
          textToQuery,
          userId,
          labelMatch.id,
          labelMatch.provider as DataSourceProvider,
          question,
          context.honorific,
        );
      }

      // Resolve the provider before named DB accounts. Multiple Postgres
      // accounts must not interrupt an explicit Stripe or MongoDB request.
      const connected = [...new Set(
        allConnected.map((account) => account.provider as DataSourceProvider),
      )];
      const provider = connected.length === 1
        ? connected[0]
        : keywordGuess(question, connected)
          ?? await textToQuery.pickProvider(userId, question, connected);

      if (!provider) {
        const names = allConnected.map((account) => account.label).join(", ");
        return {
          tool: "business_snapshot",
          status: "ok",
          message: `I have ${names} connected, ${context.honorific}. Which source should I check?`,
        };
      }

      const providerAccounts = allConnected.filter((account) => account.provider === provider);
      if (providerAccounts.length > 1) {
        const list = providerAccounts
          .map((account, index) => `${index + 1}. ${account.label}`)
          .join("\n");
        return {
          tool: "business_snapshot",
          status: "ok",
          message: `You have multiple ${displayProvider(provider)} accounts connected, ${context.honorific}. Which one should I check?\n\n${list}`,
        };
      }

      const account = providerAccounts[0];
      if (!account) {
        return {
          tool: "business_snapshot",
          status: "needs_connection",
          message: providerConnectionMessage(provider, context.honorific),
        };
      }

      return answerFromAccount(
        connectors,
        postgres,
        mongo,
        razorpay,
        stripe,
        textToQuery,
        userId,
        account.id,
        provider,
        question,
        context.honorific,
      );
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
      const account = accounts.find((candidate) => candidate.id === accountId);
      if (!account) {
        return {
          tool: "business_snapshot",
          status: "invalid_input",
          message: `That ${displayProvider(provider)} account is no longer available, ${honorific}.`,
        };
      }
      return provider === "postgres"
        ? answerFromPostgres(
            postgres,
            textToQuery,
            userId,
            account.connectionUrl,
            question,
            honorific,
          )
        : answerFromMongo(
            mongo,
            textToQuery,
            userId,
            account.connectionUrl,
            question,
            honorific,
          );
    }

    const secretResult = await connectors.getDataSourceSecret(userId, provider, accountId);
    if (!secretResult.connected) {
      return {
        tool: "business_snapshot",
        status: "needs_connection",
        message: providerConnectionMessage(provider, honorific),
      };
    }
    if (secretResult.provider === "stripe") {
      return answerFromStripe(
        stripe,
        textToQuery,
        userId,
        secretResult.secret,
        question,
        honorific,
      );
    }
    if (secretResult.provider === "razorpay") {
      return answerFromRazorpay(
        razorpay,
        textToQuery,
        userId,
        secretResult.secret,
        question,
        honorific,
      );
    }
    return {
      tool: "business_snapshot",
      status: "invalid_input",
      message: `That source cannot answer this request, ${honorific}.`,
    };
  } catch (error) {
    logger.warn("business snapshot query failed", {
      userId,
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    const status = databaseFailureStatus(error);
    return {
      tool: "business_snapshot",
      status,
      message: databaseFailureMessage(status, provider, honorific),
    };
  }
}

function isDataSourceProvider(provider: string): provider is DataSourceProvider {
  return provider === "postgres"
    || provider === "mongodb"
    || provider === "razorpay"
    || provider === "stripe";
}

function providerConnectionMessage(provider: DataSourceProvider, honorific: string): string {
  return `${displayProvider(provider)} isn't connected yet, ${honorific}. Connect it here: ${connectorSetupUrl(provider)}`;
}

function dataConnectionMessage(honorific: string): string {
  return `No business data source is connected yet, ${honorific}. Connect Postgres (${connectorSetupUrl("postgres")}), MongoDB (${connectorSetupUrl("mongodb")}), Stripe (${connectorSetupUrl("stripe")}), or Razorpay (${connectorSetupUrl("razorpay")}).`;
}

function displayProvider(provider: DataSourceProvider): string {
  const names: Record<DataSourceProvider, string> = {
    postgres: "Postgres",
    mongodb: "MongoDB",
    razorpay: "Razorpay",
    stripe: "Stripe",
  };
  return names[provider];
}

function keywordGuess(
  question: string,
  providers: DataSourceProvider[],
): DataSourceProvider | undefined {
  const lower = question.toLowerCase();
  if (
    providers.includes("postgres")
    && /(postgres|postgresql|\bsql\b|\btable\b|\brow\b)/.test(lower)
  ) return "postgres";
  if (
    providers.includes("mongodb")
    && /(mongodb|\bmongo\b|\bcollection\b|\bdocument\b)/.test(lower)
  ) return "mongodb";
  if (
    providers.includes("stripe")
    && /(stripe|charge|payment_intent|invoice|subscription|customer)/.test(lower)
  ) return "stripe";
  if (
    providers.includes("razorpay")
    && /(razorpay|payment|transaction|refund|settlement|revenue|mrr|order)/.test(lower)
  ) return "razorpay";
  if (/(signup|user|record|count)/.test(lower)) {
    const databases = providers.filter(
      (provider) => provider === "postgres" || provider === "mongodb",
    );
    return databases.length === 1 ? databases[0] : undefined;
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
      status: "invalid_input",
      message: `I couldn't translate that into a database query, ${honorific}.`,
    };
  }

  const { rows } = await postgres.runReadOnlyQuery(connectionUrl, sql, [], schema);
  const safeRows = sanitizeDatabaseRows(rows);
  return {
    tool: "business_snapshot",
    status: "ok",
    message: summarizeRows(safeRows, honorific),
    data: { provider: "postgres", rows: safeRows },
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
      status: "invalid_input",
      message: `I couldn't translate that into a database query, ${honorific}.`,
    };
  }

  const { documents } = await mongo.runQuery(connectionUrl, spec, schema);
  const safeDocuments = sanitizeDatabaseRows(documents);
  return {
    tool: "business_snapshot",
    status: "ok",
    message: summarizeRows(safeDocuments, honorific),
    data: { provider: "mongodb", documents: safeDocuments },
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
  if (rows.length === 1) {
    return `Result, ${honorific}: ${JSON.stringify(rows[0]).slice(0, 600)}`;
  }
  return `Found ${rows.length} records, ${honorific}. First: ${JSON.stringify(rows[0]).slice(0, 400)}`;
}

function databaseFailureStatus(
  error: unknown,
): "invalid_input" | "needs_connection" | "transient_error" {
  const message = error instanceof Error ? error.message : String(error);
  if (/authentication|password|not authorized|unauthorized|permission denied/i.test(message)) {
    return "needs_connection";
  }
  if (
    /sql_rejected|schema_rejected|syntax error|column .* does not exist|relation .* does not exist|operator does not exist|invalid input syntax|mongo_.*(?:not_allowed|invalid|unknown|too_)|invalid_mongo/i.test(message)
  ) {
    return "invalid_input";
  }
  return "transient_error";
}

function databaseFailureMessage(
  status: "invalid_input" | "needs_connection" | "transient_error",
  provider: DataSourceProvider,
  honorific: string,
): string {
  if (status === "needs_connection") {
    return `${displayProvider(provider)} needs to be reconnected, ${honorific}: ${connectorSetupUrl(provider)}`;
  }
  if (status === "invalid_input") {
    return `I couldn't translate that into a safe ${displayProvider(provider)} query, ${honorific}. Try naming the metric and time range more explicitly.`;
  }
  return `${displayProvider(provider)} is temporarily unavailable, ${honorific}. Please try again shortly.`;
}
