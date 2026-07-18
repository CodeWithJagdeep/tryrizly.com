import { createHash, randomBytes } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { MongoClient, ObjectId, type Document } from "mongodb";
import { env } from "@heyriz/shared/env";

export type MongoIntrospectedField = { name: string; types: string[] };
export type MongoIntrospectedCollection = { name: string; sampledFields: MongoIntrospectedField[] };
export type MongoIntrospectedSchema = { collections: MongoIntrospectedCollection[] };

export type MongoFindSpec = {
  operation?: "find";
  collection: string;
  filter?: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
};

export type MongoAggregateSpec = {
  operation: "aggregate";
  collection: string;
  pipeline: Record<string, unknown>[];
};

export type MongoQuerySpec = MongoFindSpec | MongoAggregateSpec;
export type MongoCountSpec = { collection: string; filter?: Record<string, unknown> };
type ValidatedMongoFindSpec = {
  operation: "find";
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit: number;
};

type ClientEntry = { client: MongoClient; lastUsedAt: number };
type SchemaCacheEntry = { at: number; schema: MongoIntrospectedSchema };

const MAX_DOCS = 50;
const MAX_CLIENTS = 32;
const MAX_COLLECTIONS = 100;
const MAX_SCHEMA_CACHE_ENTRIES = 128;
const MAX_PIPELINE_STAGES = 8;
const MAX_FILTER_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;

const FILTER_OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$exists",
  "$regex",
  "$and",
  "$or",
  "$not",
  "$elemMatch",
]);

const AGGREGATE_STAGES = new Set([
  "$match",
  "$group",
  "$project",
  "$sort",
  "$limit",
  "$count",
  "$unwind",
]);

const ACCUMULATORS = new Set(["$sum", "$avg", "$min", "$max", "$first", "$last"]);
const EXPRESSION_OPERATORS = new Set([
  "$literal",
  "$ifNull",
  "$cond",
  "$dateToString",
  "$dateTrunc",
  "$toDate",
  "$toString",
  "$subtract",
  "$add",
  "$multiply",
  "$divide",
  "$size",
  "$sum",
  "$avg",
  "$min",
  "$max",
  "$first",
  "$last",
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$and",
  "$or",
  "$not",
]);

/**
 * Executes read-only queries against a principal's external MongoDB. Every
 * model-produced query is normalized through a small allowlist before the
 * driver sees it; connector credentials are independently verified at save.
 */
@Injectable()
export class MongoIntrospectionService implements OnModuleDestroy {
  private readonly clients = new Map<string, ClientEntry>();
  private readonly schemaCache = new Map<string, SchemaCacheEntry>();

  async getSchema(userId: string, connectionUrl: string): Promise<MongoIntrospectedSchema> {
    const cacheKey = `${userId}:${hash(connectionUrl)}`;
    const cached = this.schemaCache.get(cacheKey);
    if (cached && Date.now() - cached.at < env.CONNECTOR_SCHEMA_CACHE_TTL_MS) {
      return cached.schema;
    }

    const db = await this.dbFor(connectionUrl);
    const collections = (
      await db.listCollections({}, {
        nameOnly: true,
        maxTimeMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
      }).toArray()
    ).slice(0, MAX_COLLECTIONS);

    const result: MongoIntrospectedCollection[] = [];
    for (let index = 0; index < collections.length; index += 5) {
      const batch = collections.slice(index, index + 5);
      result.push(...await Promise.all(batch.map(async ({ name }) => {
        const sample = await db
          .collection(name)
          .find({})
          .limit(env.CONNECTOR_MONGO_SAMPLE_SIZE)
          .maxTimeMS(env.CONNECTOR_QUERY_TIMEOUT_MS)
          .toArray();
        return {
          name,
          sampledFields: inferFields(sample as Record<string, unknown>[]),
        };
      })));
    }
    const schema = { collections: result };
    evictOldestCacheEntry(this.schemaCache, MAX_SCHEMA_CACHE_ENTRIES);
    this.schemaCache.set(cacheKey, { at: Date.now(), schema });
    return schema;
  }

  async assertReadOnly(connectionUrl: string): Promise<void> {
    const client = mongoClient(connectionUrl);
    try {
      await client.connect();
      const status = (await client.db().admin().command({
        connectionStatus: 1,
        showPrivileges: true,
        maxTimeMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
      })) as {
        authInfo?: {
          authenticatedUserPrivileges?: Array<{ actions?: string[] }>;
          authenticatedUserRoles?: Array<{ role?: string }>;
        };
      };

      const privileges = status.authInfo?.authenticatedUserPrivileges;
      if (privileges) {
        const writeActions = new Set(
          privileges.flatMap((privilege) => privilege.actions ?? [])
            .filter((action) => !READ_ONLY_ACTIONS.has(action)),
        );
        if (writeActions.size > 0) {
          throw new Error(
            `mongo_connection_not_read_only:${[...writeActions].slice(0, 5).join(",")}`,
          );
        }
        return;
      }

      const roles = status.authInfo?.authenticatedUserRoles ?? [];
      const unsafeRoles = roles.filter((role) => !READ_ONLY_ROLES.has(role.role ?? ""));
      if (roles.length === 0 || unsafeRoles.length > 0) {
        throw new Error(
          `mongo_connection_not_read_only:${unsafeRoles.map((role) => role.role).join(",") || "unknown_privileges"}`,
        );
      }
    } finally {
      await client.close();
    }
  }

  async provisionReadOnlyUser(connectionUrl: string): Promise<string> {
    const client = mongoClient(connectionUrl);
    try {
      await client.connect();
      const db = client.db();
      const username = `rizly_ro_${randomBytes(4).toString("hex")}`;
      const password = randomBytes(24).toString("base64url");
      await db.command({
        createUser: username,
        pwd: password,
        roles: [{ role: "read", db: db.databaseName }],
        maxTimeMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
      });
      return withScopedCredentials(connectionUrl, username, password, db.databaseName);
    } finally {
      await client.close();
    }
  }

  async runQuery(
    connectionUrl: string,
    candidate: unknown,
    schema: MongoIntrospectedSchema,
  ): Promise<{ documents: unknown[] }> {
    const spec = validateMongoQuerySpec(candidate, schema);
    const collection = (await this.dbFor(connectionUrl)).collection(spec.collection);
    if (spec.operation === "aggregate") {
      const documents = await collection
        .aggregate(spec.pipeline as Document[], {
          allowDiskUse: false,
          maxTimeMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
        })
        .toArray();
      return { documents };
    }

    const documents = await collection
      .find(spec.filter as Document, {
        projection: spec.projection,
        sort: spec.sort,
      })
      .limit(spec.limit)
      .maxTimeMS(env.CONNECTOR_QUERY_TIMEOUT_MS)
      .toArray();
    return { documents };
  }

  async runFind(
    connectionUrl: string,
    candidate: MongoFindSpec,
    schema?: MongoIntrospectedSchema,
  ): Promise<{ documents: unknown[] }> {
    const resolvedSchema = schema ?? await this.getSchema("runtime", connectionUrl);
    return this.runQuery(connectionUrl, { ...candidate, operation: "find" }, resolvedSchema);
  }

  async countDocuments(
    connectionUrl: string,
    candidate: unknown,
    schema: MongoIntrospectedSchema,
  ): Promise<number> {
    const spec = validateMongoCountSpec(candidate, schema);
    return (await this.dbFor(connectionUrl))
      .collection(spec.collection)
      .countDocuments(spec.filter as Document, {
        maxTimeMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
      });
  }

  async onModuleDestroy() {
    await Promise.all([...this.clients.values()].map(({ client }) => client.close()));
  }

  private async dbFor(connectionUrl: string) {
    const key = hash(connectionUrl);
    const existing = this.clients.get(key);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing.client.db();
    }

    if (this.clients.size >= MAX_CLIENTS) {
      const oldest = [...this.clients.entries()].sort(
        (left, right) => left[1].lastUsedAt - right[1].lastUsedAt,
      )[0];
      if (oldest) {
        this.clients.delete(oldest[0]);
        void oldest[1].client.close().catch(() => undefined);
      }
    }

    const client = mongoClient(connectionUrl);
    await client.connect();
    this.clients.set(key, { client, lastUsedAt: Date.now() });
    return client.db();
  }
}

export function validateMongoQuerySpec(
  candidate: unknown,
  schema: MongoIntrospectedSchema,
): ValidatedMongoFindSpec | MongoAggregateSpec {
  const raw = assertPlainObject(candidate, "invalid_mongo_query");
  const collection = validateCollection(raw.collection, schema);
  const operation = raw.operation ?? "find";

  if (operation === "find") {
    rejectUnexpectedKeys(raw, new Set([
      "operation",
      "collection",
      "filter",
      "projection",
      "sort",
      "limit",
    ]));
    return {
      operation: "find",
      collection,
      filter: validateFilter(raw.filter ?? {}, 0),
      projection: validateProjection(raw.projection),
      sort: validateSort(raw.sort),
      limit: validatePositiveLimit(raw.limit ?? MAX_DOCS),
    };
  }

  if (operation !== "aggregate") throw new Error("mongo_operation_not_allowed");
  rejectUnexpectedKeys(raw, new Set(["operation", "collection", "pipeline"]));
  if (!Array.isArray(raw.pipeline) || raw.pipeline.length === 0) {
    throw new Error("invalid_mongo_pipeline");
  }
  if (raw.pipeline.length > MAX_PIPELINE_STAGES) throw new Error("mongo_pipeline_too_long");

  const pipeline = raw.pipeline.map((stage) => validatePipelineStage(stage));
  const finalStage = pipeline.at(-1);
  if (finalStage && "$limit" in finalStage) {
    finalStage.$limit = validatePositiveLimit(finalStage.$limit);
  } else {
    if (pipeline.length >= MAX_PIPELINE_STAGES) throw new Error("mongo_pipeline_too_long");
    pipeline.push({ $limit: MAX_DOCS });
  }
  return { operation: "aggregate", collection, pipeline };
}

export function validateMongoCountSpec(
  candidate: unknown,
  schema: MongoIntrospectedSchema,
): Required<MongoCountSpec> {
  const raw = assertPlainObject(candidate, "invalid_mongo_count_query");
  rejectUnexpectedKeys(raw, new Set(["collection", "filter"]));
  return {
    collection: validateCollection(raw.collection, schema),
    filter: validateFilter(raw.filter ?? {}, 0),
  };
}

const READ_ONLY_ACTIONS = new Set([
  "changeStream",
  "collStats",
  "dbHash",
  "dbStats",
  "find",
  "killCursors",
  "listCollections",
  "listIndexes",
  "listSearchIndexes",
  "planCacheRead",
  "listDatabases",
  "listSessions",
]);

const READ_ONLY_ROLES = new Set(["read", "readAnyDatabase"]);

function mongoClient(connectionUrl: string): MongoClient {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(connectionUrl)) {
    throw new Error("invalid_mongodb_connection_url");
  }
  return new MongoClient(connectionUrl, {
    connectTimeoutMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
    serverSelectionTimeoutMS: env.CONNECTOR_QUERY_TIMEOUT_MS,
  });
}

function withScopedCredentials(
  connectionUrl: string,
  username: string,
  password: string,
  authSourceDb: string,
): string {
  const withCreds = connectionUrl.replace(
    /^(mongodb(?:\+srv)?:\/\/)(?:[^@/?]*(?::[^@/?]*)?@)?/,
    `$1${encodeURIComponent(username)}:${encodeURIComponent(password)}@`,
  );
  const [base, query = ""] = withCreds.split("?");
  const params = new URLSearchParams(query);
  params.set("authSource", authSourceDb);
  return `${base}?${params.toString()}`;
}

function inferFields(sample: Record<string, unknown>[]): MongoIntrospectedField[] {
  const fields = new Map<string, Set<string>>();
  for (const document of sample) collectFields(document, "", fields, 0);
  return [...fields.entries()].map(([name, types]) => ({ name, types: [...types] }));
}

function collectFields(
  value: Record<string, unknown>,
  prefix: string,
  fields: Map<string, Set<string>>,
  depth: number,
) {
  for (const [key, child] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    const types = fields.get(name) ?? new Set<string>();
    types.add(typeOf(child));
    fields.set(name, types);
    if (depth < 2 && isPlainObject(child) && !isExtendedJson(child)) {
      collectFields(child, name, fields, depth + 1);
    }
  }
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value instanceof ObjectId) return "objectId";
  return typeof value;
}

function validateCollection(value: unknown, schema: MongoIntrospectedSchema): string {
  if (typeof value !== "string" || !safeMongoName(value)) {
    throw new Error("invalid_mongo_collection");
  }
  if (!schema.collections.some((collection) => collection.name === value)) {
    throw new Error("unknown_mongo_collection");
  }
  return value;
}

function validateFilter(value: unknown, depth: number): Record<string, unknown> {
  if (depth > MAX_FILTER_DEPTH) throw new Error("mongo_filter_too_deep");
  const filter = assertPlainObject(value, "invalid_mongo_filter");
  if (Object.keys(filter).length > MAX_OBJECT_KEYS) throw new Error("mongo_filter_too_large");
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(filter)) {
    if (key.startsWith("$")) {
      if (!FILTER_OPERATORS.has(key)) throw new Error(`mongo_operator_not_allowed:${key}`);
      if (key === "$and" || key === "$or") {
        if (!Array.isArray(child) || child.length === 0 || child.length > MAX_ARRAY_ITEMS) {
          throw new Error(`invalid_mongo_operator_value:${key}`);
        }
        output[key] = child.map((item) => validateFilter(item, depth + 1));
        continue;
      }
      throw new Error(`mongo_operator_wrong_context:${key}`);
    }

    if (!safeMongoName(key)) throw new Error("invalid_mongo_field");
    output[key] = validateFieldCondition(child, depth + 1);
  }
  return output;
}

function validateFieldCondition(value: unknown, depth: number): unknown {
  if (depth > MAX_FILTER_DEPTH) throw new Error("mongo_filter_too_deep");
  const hydrated = hydrateExtendedJson(value);
  if (!isPlainObject(hydrated)) return validateLiteral(hydrated, depth);

  const entries = Object.entries(hydrated);
  if (entries.some(([key]) => key.startsWith("$"))) {
    const output: Record<string, unknown> = {};
    for (const [operator, operand] of entries) {
      if (!FILTER_OPERATORS.has(operator)) {
        throw new Error(`mongo_operator_not_allowed:${operator}`);
      }
      if (operator === "$and" || operator === "$or") {
        throw new Error(`mongo_operator_wrong_context:${operator}`);
      }
      if (operator === "$exists") {
        if (typeof operand !== "boolean") throw new Error("invalid_mongo_exists");
        output[operator] = operand;
      } else if (operator === "$regex") {
        if (typeof operand !== "string" || operand.length > 200) {
          throw new Error("invalid_mongo_regex");
        }
        output[operator] = operand;
      } else if (operator === "$in" || operator === "$nin") {
        if (!Array.isArray(operand) || operand.length > MAX_ARRAY_ITEMS) {
          throw new Error(`invalid_mongo_operator_value:${operator}`);
        }
        output[operator] = operand.map((item) => validateLiteral(hydrateExtendedJson(item), depth + 1));
      } else if (operator === "$not" || operator === "$elemMatch") {
        output[operator] = operator === "$elemMatch"
          ? validateFilter(operand, depth + 1)
          : validateFieldCondition(operand, depth + 1);
      } else {
        output[operator] = validateLiteral(hydrateExtendedJson(operand), depth + 1);
      }
    }
    return output;
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of entries) {
    if (!safeMongoName(key)) throw new Error("invalid_mongo_field");
    output[key] = validateFieldCondition(child, depth + 1);
  }
  return output;
}

function validateLiteral(value: unknown, depth: number): unknown {
  if (depth > MAX_FILTER_DEPTH) throw new Error("mongo_filter_too_deep");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date || value instanceof ObjectId) return value;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) throw new Error("mongo_array_too_large");
    return value.map((item) => validateLiteral(hydrateExtendedJson(item), depth + 1));
  }
  if (isPlainObject(value)) return validateFieldCondition(value, depth + 1);
  throw new Error("invalid_mongo_value");
}

function validateProjection(value: unknown): Record<string, 0 | 1> | undefined {
  if (value === undefined) return undefined;
  const projection = assertPlainObject(value, "invalid_mongo_projection");
  if (Object.keys(projection).length > MAX_OBJECT_KEYS) throw new Error("mongo_projection_too_large");
  const output: Record<string, 0 | 1> = {};
  for (const [field, include] of Object.entries(projection)) {
    if (!safeMongoName(field) || (include !== 0 && include !== 1)) {
      throw new Error("invalid_mongo_projection");
    }
    output[field] = include;
  }
  return output;
}

function validateSort(value: unknown): Record<string, 1 | -1> | undefined {
  if (value === undefined) return undefined;
  const sort = assertPlainObject(value, "invalid_mongo_sort");
  if (Object.keys(sort).length > 20) throw new Error("mongo_sort_too_large");
  const output: Record<string, 1 | -1> = {};
  for (const [field, direction] of Object.entries(sort)) {
    if (!safeMongoName(field) || (direction !== 1 && direction !== -1)) {
      throw new Error("invalid_mongo_sort");
    }
    output[field] = direction;
  }
  return output;
}

function validatePipelineStage(value: unknown): Record<string, unknown> {
  const stage = assertPlainObject(value, "invalid_mongo_pipeline_stage");
  const entries = Object.entries(stage);
  if (entries.length !== 1 || !AGGREGATE_STAGES.has(entries[0][0])) {
    throw new Error("mongo_pipeline_stage_not_allowed");
  }
  const [operator, operand] = entries[0];
  if (operator === "$match") return { $match: validateFilter(operand, 0) };
  if (operator === "$sort") return { $sort: validateSort(operand) ?? {} };
  if (operator === "$limit") return { $limit: validatePositiveLimit(operand) };
  if (operator === "$count") {
    if (typeof operand !== "string" || !safeMongoName(operand)) throw new Error("invalid_mongo_count");
    return { $count: operand };
  }
  if (operator === "$unwind") return { $unwind: validateUnwind(operand) };
  if (operator === "$group") return { $group: validateGroup(operand) };
  return { $project: validateAggregateProject(operand) };
}

function validateGroup(value: unknown): Record<string, unknown> {
  const group = assertPlainObject(value, "invalid_mongo_group");
  if (!("_id" in group) || Object.keys(group).length > MAX_OBJECT_KEYS) {
    throw new Error("invalid_mongo_group");
  }
  const output: Record<string, unknown> = { _id: validateExpression(group._id, 0) };
  for (const [field, accumulator] of Object.entries(group)) {
    if (field === "_id") continue;
    if (!safeMongoName(field)) throw new Error("invalid_mongo_group_field");
    const expression = assertPlainObject(accumulator, "invalid_mongo_accumulator");
    const entries = Object.entries(expression);
    if (entries.length !== 1 || !ACCUMULATORS.has(entries[0][0])) {
      throw new Error("mongo_accumulator_not_allowed");
    }
    output[field] = { [entries[0][0]]: validateExpression(entries[0][1], 0) };
  }
  return output;
}

function validateAggregateProject(value: unknown): Record<string, unknown> {
  const project = assertPlainObject(value, "invalid_mongo_project");
  if (Object.keys(project).length > MAX_OBJECT_KEYS) throw new Error("mongo_project_too_large");
  const output: Record<string, unknown> = {};
  for (const [field, expression] of Object.entries(project)) {
    if (!safeMongoName(field)) throw new Error("invalid_mongo_project_field");
    output[field] = expression === 0 || expression === 1
      ? expression
      : validateExpression(expression, 0);
  }
  return output;
}

function validateUnwind(value: unknown): string | Record<string, unknown> {
  if (
    typeof value === "string"
    && /^\$[^$\0]+$/.test(value)
    && safeMongoName(value.slice(1))
  ) return value;
  const unwind = assertPlainObject(value, "invalid_mongo_unwind");
  rejectUnexpectedKeys(unwind, new Set(["path", "preserveNullAndEmptyArrays"]));
  if (
    typeof unwind.path !== "string"
    || !/^\$[^$\0]+$/.test(unwind.path)
    || !safeMongoName(unwind.path.slice(1))
  ) {
    throw new Error("invalid_mongo_unwind");
  }
  if (
    unwind.preserveNullAndEmptyArrays !== undefined &&
    typeof unwind.preserveNullAndEmptyArrays !== "boolean"
  ) {
    throw new Error("invalid_mongo_unwind");
  }
  return unwind;
}

function validateExpression(value: unknown, depth: number): unknown {
  if (depth > MAX_FILTER_DEPTH) throw new Error("mongo_expression_too_deep");
  const hydrated = hydrateExtendedJson(value);
  if (hydrated === null || typeof hydrated === "boolean") return hydrated;
  if (typeof hydrated === "number" && Number.isFinite(hydrated)) return hydrated;
  if (typeof hydrated === "string") {
    if (hydrated.startsWith("$$") && hydrated !== "$$NOW") {
      throw new Error("mongo_variable_not_allowed");
    }
    if (hydrated.startsWith("$") && !hydrated.startsWith("$$") && !safeMongoName(hydrated.slice(1))) {
      throw new Error("invalid_mongo_field_reference");
    }
    return hydrated;
  }
  if (hydrated instanceof Date || hydrated instanceof ObjectId) return hydrated;
  if (Array.isArray(hydrated)) {
    if (hydrated.length > MAX_ARRAY_ITEMS) throw new Error("mongo_array_too_large");
    return hydrated.map((item) => validateExpression(item, depth + 1));
  }
  const expression = assertPlainObject(hydrated, "invalid_mongo_expression");
  const output: Record<string, unknown> = {};
  const entries = Object.entries(expression);
  if (entries.every(([key]) => !key.startsWith("$"))) {
    for (const [field, child] of entries) {
      if (!safeMongoName(field)) throw new Error("invalid_mongo_expression_field");
      output[field] = validateExpression(child, depth + 1);
    }
    return output;
  }
  for (const [operator, operand] of entries) {
    if (!EXPRESSION_OPERATORS.has(operator)) {
      throw new Error(`mongo_expression_not_allowed:${operator}`);
    }
    output[operator] = validateExpressionOperand(operator, operand, depth + 1);
  }
  return output;
}

function validateExpressionOperand(operator: string, value: unknown, depth: number): unknown {
  if (operator === "$literal") return validateLiteral(hydrateExtendedJson(value), depth);
  if (operator === "$dateTrunc") {
    const options = assertPlainObject(value, "invalid_mongo_date_trunc");
    rejectUnexpectedKeys(options, new Set(["date", "unit", "binSize", "timezone", "startOfWeek"]));
    if (!("date" in options) || typeof options.unit !== "string") {
      throw new Error("invalid_mongo_date_trunc");
    }
    const output: Record<string, unknown> = {
      date: validateExpression(options.date, depth + 1),
      unit: options.unit,
    };
    if (options.binSize !== undefined) {
      if (typeof options.binSize !== "number" || !Number.isInteger(options.binSize) || options.binSize <= 0) {
        throw new Error("invalid_mongo_date_trunc");
      }
      output.binSize = options.binSize;
    }
    if (options.timezone !== undefined) {
      if (typeof options.timezone !== "string" || options.timezone.length > 100) {
        throw new Error("invalid_mongo_date_trunc");
      }
      output.timezone = options.timezone;
    }
    if (options.startOfWeek !== undefined) {
      if (typeof options.startOfWeek !== "string" || options.startOfWeek.length > 16) {
        throw new Error("invalid_mongo_date_trunc");
      }
      output.startOfWeek = options.startOfWeek;
    }
    return output;
  }
  if (operator === "$dateToString") {
    const options = assertPlainObject(value, "invalid_mongo_date_to_string");
    rejectUnexpectedKeys(options, new Set(["date", "format", "timezone", "onNull"]));
    if (!("date" in options)) throw new Error("invalid_mongo_date_to_string");
    const output: Record<string, unknown> = {
      date: validateExpression(options.date, depth + 1),
    };
    for (const option of ["format", "timezone"] as const) {
      if (options[option] !== undefined) {
        if (typeof options[option] !== "string" || options[option].length > 200) {
          throw new Error("invalid_mongo_date_to_string");
        }
        output[option] = options[option];
      }
    }
    if (options.onNull !== undefined) {
      output.onNull = validateExpression(options.onNull, depth + 1);
    }
    return output;
  }
  if (operator === "$cond" && isPlainObject(value)) {
    const condition = assertPlainObject(value, "invalid_mongo_cond");
    rejectUnexpectedKeys(condition, new Set(["if", "then", "else"]));
    if (!("if" in condition) || !("then" in condition) || !("else" in condition)) {
      throw new Error("invalid_mongo_cond");
    }
    return {
      if: validateExpression(condition.if, depth + 1),
      then: validateExpression(condition.then, depth + 1),
      else: validateExpression(condition.else, depth + 1),
    };
  }
  return validateExpression(value, depth + 1);
}

function hydrateExtendedJson(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const entries = Object.entries(value);
  if (entries.length === 1 && entries[0][0] === "$date") {
    if (typeof entries[0][1] !== "string") throw new Error("invalid_mongo_date");
    const date = new Date(entries[0][1]);
    if (Number.isNaN(date.getTime())) throw new Error("invalid_mongo_date");
    return date;
  }
  if (entries.length === 1 && entries[0][0] === "$oid") {
    if (typeof entries[0][1] !== "string" || !ObjectId.isValid(entries[0][1])) {
      throw new Error("invalid_mongo_object_id");
    }
    return new ObjectId(entries[0][1]);
  }
  return value;
}

function isExtendedJson(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && (keys[0] === "$date" || keys[0] === "$oid");
}

function validatePositiveLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("invalid_mongo_limit");
  }
  return Math.min(value, MAX_DOCS);
}

function rejectUnexpectedKeys(value: Record<string, unknown>, allowed: Set<string>) {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`unexpected_mongo_query_key:${unexpected}`);
}

function safeMongoName(value: string): boolean {
  if (!value || value.length > 200 || value.includes("$") || value.includes("\0")) return false;
  return !value.split(".").some((part) =>
    !part || part === "__proto__" || part === "prototype" || part === "constructor"
  );
}

function assertPlainObject(value: unknown, message: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(message);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function evictOldestCacheEntry<T extends { at: number }>(cache: Map<string, T>, max: number) {
  if (cache.size < max) return;
  const oldest = [...cache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
  if (oldest) cache.delete(oldest[0]);
}
