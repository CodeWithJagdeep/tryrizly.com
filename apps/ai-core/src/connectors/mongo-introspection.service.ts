import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { MongoClient } from "mongodb";
import { env } from "@heyriz/shared/env";

export type MongoIntrospectedField = { name: string; types: string[] };
export type MongoIntrospectedCollection = { name: string; sampledFields: MongoIntrospectedField[] };
export type MongoIntrospectedSchema = { collections: MongoIntrospectedCollection[] };

export type MongoQuerySpec = {
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
};

const MAX_DOCS = 50;

/**
 * Talks to a principal's OWN external MongoDB cluster (vault-stored
 * connectionUrl) — distinct from shared/'s mongo client, which is heyriz's
 * own app database. Schema is inferred by sampling, since Mongo has none.
 * The LLM-driven query path only ever calls find() — never aggregate() —
 * so $out/$merge/$where/db.eval are not just denylisted, they're not
 * reachable through this shape at all.
 */
@Injectable()
export class MongoIntrospectionService implements OnModuleDestroy {
  private readonly clients = new Map<string, MongoClient>();

  async getSchema(_userId: string, connectionUrl: string): Promise<MongoIntrospectedSchema> {
    const db = await this.dbFor(connectionUrl);
    const collections = await db.listCollections().toArray();

    const result: MongoIntrospectedCollection[] = [];
    for (const { name } of collections) {
      const sample = (await db
        .collection(name)
        .aggregate([{ $sample: { size: env.CONNECTOR_MONGO_SAMPLE_SIZE } }])
        .toArray()) as Record<string, unknown>[];
      result.push({ name, sampledFields: inferFields(sample) });
    }
    return { collections: result };
  }

  /**
   * Rejects a connection string whose authenticated user can write. Checked
   * once at connector-save time (see ConnectorService.saveManual) — mirrors
   * the protection Postgres gets for free from `BEGIN READ ONLY`, which Mongo
   * has no equivalent of, so it has to be enforced by inspecting privileges.
   */
  async assertReadOnly(connectionUrl: string): Promise<void> {
    const client = new MongoClient(connectionUrl);
    try {
      await client.connect();
      const status = (await client.db().admin().command({
        connectionStatus: 1,
        showPrivileges: true,
      })) as {
        authInfo?: {
          authenticatedUserPrivileges?: Array<{ actions?: string[] }>;
          authenticatedUserRoles?: Array<{ role?: string }>;
        };
      };

      const privileges = status.authInfo?.authenticatedUserPrivileges;
      if (privileges) {
        const writeActions = new Set(
          privileges.flatMap((p) => p.actions ?? []).filter((a) => !READ_ONLY_ACTIONS.has(a)),
        );
        if (writeActions.size > 0) {
          throw new Error(
            `mongo_connection_not_read_only:${[...writeActions].slice(0, 5).join(",")}`,
          );
        }
        return;
      }

      // Server didn't return expanded privileges (showPrivileges can be
      // restricted) — fail closed unless every role is a known read-only
      // built-in. A custom role with unknown grants is treated as unsafe.
      const roles = status.authInfo?.authenticatedUserRoles ?? [];
      const unsafeRoles = roles.filter((r) => !READ_ONLY_ROLES.has(r.role ?? ""));
      if (roles.length === 0 || unsafeRoles.length > 0) {
        throw new Error(
          `mongo_connection_not_read_only:${unsafeRoles.map((r) => r.role).join(",") || "unknown_privileges"}`,
        );
      }
    } finally {
      await client.close();
    }
  }

  async runFind(connectionUrl: string, spec: MongoQuerySpec): Promise<{ documents: unknown[] }> {
    assertSafeFilter(spec.filter);
    const db = await this.dbFor(connectionUrl);
    const documents = await db
      .collection(spec.collection)
      .find(spec.filter, { projection: spec.projection, sort: spec.sort })
      .limit(Math.min(spec.limit ?? MAX_DOCS, MAX_DOCS))
      .toArray();
    return { documents };
  }

  async onModuleDestroy() {
    await Promise.all([...this.clients.values()].map((client) => client.close()));
  }

  private async dbFor(connectionUrl: string) {
    let client = this.clients.get(connectionUrl);
    if (!client) {
      client = new MongoClient(connectionUrl);
      await client.connect();
      this.clients.set(connectionUrl, client);
    }
    return client.db();
  }
}

/**
 * Exactly the actions MongoDB's built-in "read" role grants (per Mongo docs),
 * plus a couple of harmless server-info reads — everything else is treated
 * as write access. Keeping this matched to "read" avoids false-rejecting the
 * exact role we're telling users to create.
 */
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

/** Built-in roles known to grant read-only access. Custom roles are never trusted by name alone. */
const READ_ONLY_ROLES = new Set(["read", "readAnyDatabase"]);

function inferFields(sample: Record<string, unknown>[]): MongoIntrospectedField[] {
  const fields = new Map<string, Set<string>>();
  for (const doc of sample) {
    for (const [key, value] of Object.entries(doc)) {
      const types = fields.get(key) ?? new Set<string>();
      types.add(typeOf(value));
      fields.set(key, types);
    }
  }
  return [...fields.entries()].map(([name, types]) => ({ name, types: [...types] }));
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  return typeof value;
}

/** Defense against `filter` being typed Record<string, unknown> — a prompt instruction isn't enforcement, this is. */
function assertSafeFilter(filter: Record<string, unknown>, depth = 0): void {
  if (depth > 8) return;
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$where" || key === "$function") {
      throw new Error("forbidden_mongo_operator");
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          assertSafeFilter(item as Record<string, unknown>, depth + 1);
        }
      }
    } else if (value && typeof value === "object") {
      assertSafeFilter(value as Record<string, unknown>, depth + 1);
    }
  }
}
