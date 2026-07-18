import { describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({
  env: {
    CONNECTOR_QUERY_TIMEOUT_MS: 8_000,
    CONNECTOR_SCHEMA_CACHE_TTL_MS: 900_000,
    CONNECTOR_MONGO_SAMPLE_SIZE: 20,
  },
}));

import {
  validateMongoCountSpec,
  validateMongoQuerySpec,
  type MongoIntrospectedSchema,
} from "./mongo-introspection.service";

const schema: MongoIntrospectedSchema = {
  collections: [{
    name: "users",
    sampledFields: [
      { name: "createdAt", types: ["date"] },
      { name: "plan", types: ["string"] },
    ],
  }],
};

describe("Mongo query validation", () => {
  it("normalizes find limits and Extended JSON dates", () => {
    const spec = validateMongoQuerySpec({
      operation: "find",
      collection: "users",
      filter: { createdAt: { $gte: { $date: "2026-07-01T00:00:00.000Z" } } },
      limit: 500,
    }, schema);
    expect(spec.operation).toBe("find");
    if (spec.operation !== "find") throw new Error("expected find");
    expect(spec.limit).toBe(50);
    expect((spec.filter.createdAt as { $gte: unknown }).$gte).toBeInstanceOf(Date);
  });

  it.each([
    { collection: "users", filter: { $where: "return true" } },
    { collection: "users", filter: { $not: { plan: "free" } } },
    { collection: "users", filter: { name: { $function: {} } } },
    { collection: "users", filter: {}, limit: -1 },
    { collection: "missing", filter: {} },
    { collection: "users", filter: {}, projection: { password: "yes" } },
    { collection: "users", filter: {}, unexpected: true },
  ])("rejects unsafe find input %#", (candidate) => {
    expect(() => validateMongoQuerySpec(candidate, schema)).toThrow();
  });

  it("accepts bounded analytics and appends a result limit", () => {
    const spec = validateMongoQuerySpec({
      operation: "aggregate",
      collection: "users",
      pipeline: [
        { $match: { createdAt: { $exists: true } } },
        {
          $group: {
            _id: { $dateTrunc: { date: "$createdAt", unit: "day" } },
            signups: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
    }, schema);
    expect(spec.operation).toBe("aggregate");
    if (spec.operation !== "aggregate") throw new Error("expected aggregate");
    expect(spec.pipeline.at(-1)).toEqual({ $limit: 50 });
  });

  it.each(["$lookup", "$unionWith", "$out", "$merge", "$function"])(
    "rejects aggregate stage %s",
    (stage) => {
      expect(() => validateMongoQuerySpec({
        operation: "aggregate",
        collection: "users",
        pipeline: [{ [stage]: {} }],
      }, schema)).toThrow();
    },
  );

  it("keeps count specifications separate from result-query options", () => {
    expect(validateMongoCountSpec({ collection: "users", filter: {} }, schema)).toEqual({
      collection: "users",
      filter: {},
    });
    expect(() => validateMongoCountSpec({ collection: "users", filter: {}, limit: 50 }, schema))
      .toThrow(/unexpected_mongo_query_key/);
  });
});
