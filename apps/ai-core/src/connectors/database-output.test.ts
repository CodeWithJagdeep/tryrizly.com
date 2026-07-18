import { describe, expect, it } from "vitest";
import { sanitizeDatabaseRows } from "./database-output";

describe("database output sanitization", () => {
  it("redacts credential-like fields recursively without hiding business fields", () => {
    expect(sanitizeDatabaseRows([{
      email: "owner@example.com",
      password_hash: "hash",
      profile: { apiKey: "secret", clientSecret: "client-secret", plan: "pro" },
      connectionUrl: "postgres://readonly:password@host/app",
      rows: [{ refresh_token: "token", amount: 42 }],
    }])).toEqual([{
      email: "owner@example.com",
      password_hash: "[REDACTED]",
      profile: { apiKey: "[REDACTED]", clientSecret: "[REDACTED]", plan: "pro" },
      connectionUrl: "[REDACTED]",
      rows: [{ refresh_token: "[REDACTED]", amount: 42 }],
    }]);
  });

  it("caps rows and long strings", () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({ index, text: "x".repeat(2_100) }));
    const sanitized = sanitizeDatabaseRows(rows) as Array<{ text: string }>;
    expect(sanitized).toHaveLength(50);
    expect(sanitized[0].text).toContain("[truncated]");
  });
});
