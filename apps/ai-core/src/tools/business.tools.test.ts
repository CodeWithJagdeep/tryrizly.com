import { describe, expect, it, vi } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { createBusinessSnapshotTool } from "./business.tools";

const context: HeyRizRuntimeContext = {
  userId: "owner@example.com",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: {
    connected: false,
    calendarConnected: false,
    inboxConnected: false,
    calendarStatus: "not_connected",
    inboxStatus: "not_connected",
    checkedAt: new Date(0).toISOString(),
    schedule: [],
    unread: [],
  },
  honorific: "sir",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

function account(id: string, provider: string, label: string) {
  return {
    id,
    provider,
    label,
    status: "connected",
    authType: "manual",
    scopes: [],
    metadata: {},
    userId: context.userId,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("business_snapshot routing", () => {
  it("answers an explicit Stripe question before resolving multiple Postgres accounts", async () => {
    const connectors = {
      list: vi.fn(async () => [
        account("pg-1", "postgres", "Production DB"),
        account("pg-2", "postgres", "Analytics DB"),
        account("stripe-1", "stripe", "Stripe"),
      ]),
      getDataSourceSecret: vi.fn(async () => ({
        connected: true,
        provider: "stripe",
        secret: { secretKey: "sk_live" },
      })),
    };
    const stripe = { fetch: vi.fn(async () => ({ data: [{ id: "in_1" }] })) };
    const textToQuery = {
      pickProvider: vi.fn(),
      pickStripeEndpoint: vi.fn(async () => "invoices"),
    };
    const tool = createBusinessSnapshotTool(
      connectors as never,
      {} as never,
      {} as never,
      {} as never,
      stripe as never,
      textToQuery as never,
    );

    const result = await tool.execute({
      userId: context.userId,
      payload: { question: "Show the latest Stripe invoices" },
      context,
    });
    expect(result.status).toBe("ok");
    expect(result.data).toMatchObject({ provider: "stripe", endpoint: "invoices" });
    expect(textToQuery.pickProvider).not.toHaveBeenCalled();
    expect(connectors.getDataSourceSecret).toHaveBeenCalledWith(
      context.userId,
      "stripe",
      "stripe-1",
    );
  });

  it("asks for a specific payment account instead of selecting one arbitrarily", async () => {
    const connectors = {
      list: vi.fn(async () => [
        account("stripe-us", "stripe", "US Stripe"),
        account("stripe-eu", "stripe", "EU Stripe"),
      ]),
      getDataSourceSecret: vi.fn(),
    };
    const tool = createBusinessSnapshotTool(
      connectors as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { pickProvider: vi.fn() } as never,
    );
    const result = await tool.execute({
      userId: context.userId,
      payload: { question: "Show Stripe invoices" },
      context,
    });
    expect(result.status).toBe("ok");
    expect(result.message).toContain("US Stripe");
    expect(result.message).toContain("EU Stripe");
    expect(connectors.getDataSourceSecret).not.toHaveBeenCalled();
  });

  it("never falls back to another database when the selected account disappears", async () => {
    const connectors = {
      list: vi.fn(async () => [account("pg-old", "postgres", "Production DB")]),
      getAllDataSourceSecrets: vi.fn(async () => [{
        id: "pg-other",
        label: "Staging DB",
        connectionUrl: "postgres://readonly@staging/app",
      }]),
    };
    const postgres = { getSchema: vi.fn() };
    const tool = createBusinessSnapshotTool(
      connectors as never,
      postgres as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await tool.execute({
      userId: context.userId,
      payload: { question: "Count users", accountId: "pg-old" },
      context,
    });
    expect(result.status).toBe("invalid_input");
    expect(postgres.getSchema).not.toHaveBeenCalled();
  });

  it("redacts credential-like database columns from messages and tool data", async () => {
    const connectors = {
      list: vi.fn(async () => [account("pg-1", "postgres", "Production DB")]),
      getAllDataSourceSecrets: vi.fn(async () => [{
        id: "pg-1",
        label: "Production DB",
        connectionUrl: "postgres://readonly@production/app",
      }]),
    };
    const postgres = {
      getSchema: vi.fn(async () => ({ tables: [] })),
      runReadOnlyQuery: vi.fn(async () => ({
        rows: [{ email: "owner@example.com", password_hash: "do-not-leak" }],
      })),
    };
    const textToQuery = { sqlFor: vi.fn(async () => "select email, password_hash from users") };
    const tool = createBusinessSnapshotTool(
      connectors as never,
      postgres as never,
      {} as never,
      {} as never,
      {} as never,
      textToQuery as never,
    );
    const result = await tool.execute({
      userId: context.userId,
      payload: { question: "Show the user record" },
      context,
    });
    expect(result.status).toBe("ok");
    expect(result.message).not.toContain("do-not-leak");
    expect(result.data).toEqual({
      provider: "postgres",
      rows: [{ email: "owner@example.com", password_hash: "[REDACTED]" }],
    });
  });

  it("offers database and payment connectors when no source exists", async () => {
    const tool = createBusinessSnapshotTool(
      { list: vi.fn(async () => []) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await tool.execute({
      userId: context.userId,
      payload: { question: "How many signups?" },
      context,
    });
    expect(result.status).toBe("needs_connection");
    expect(result.message).toContain("Postgres");
    expect(result.message).toContain("MongoDB");
    expect(result.message).toContain("Stripe");
    expect(result.message).toContain("Razorpay");
  });
});
