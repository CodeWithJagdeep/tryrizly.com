import { describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({ env: {} }));

import { ConnectorService } from "./connector.service";
import type { ConnectedAccount } from "./connector.types";

const existingAccount: ConnectedAccount = {
  id: "pg-primary",
  userId: "owner@example.com",
  provider: "postgres",
  authType: "manual",
  label: "Primary",
  status: "connected",
  encryptedPayload: "ciphertext",
  scopes: [],
  metadata: { source: "connectors_page" },
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("ConnectorService database saves", () => {
  it("preserves an existing connection URL when an edit submits a blank credential", async () => {
    const repository = {
      findById: vi.fn(async () => existingAccount),
      updateOwned: vi.fn(async (_id, _userId, _provider, patch) => ({
        ...existingAccount,
        ...patch,
      })),
    };
    const vault = {
      decrypt: vi.fn(() => ({ connectionUrl: "postgres://readonly:old@db.test/app" })),
      encrypt: vi.fn((secret) => JSON.stringify(secret)),
    };
    const postgres = { assertReadOnlyCredentials: vi.fn(async () => undefined) };
    const service = new ConnectorService(
      repository as never,
      vault as never,
      {} as never,
      postgres as never,
    );

    await service.saveManual({
      userId: existingAccount.userId,
      provider: "postgres",
      accountId: existingAccount.id,
      label: "Primary DB",
      secret: { connectionUrl: "" },
    });

    expect(postgres.assertReadOnlyCredentials)
      .toHaveBeenCalledWith("postgres://readonly:old@db.test/app");
    expect(vault.encrypt)
      .toHaveBeenCalledWith({ connectionUrl: "postgres://readonly:old@db.test/app" });
    expect(repository.updateOwned).toHaveBeenCalledWith(
      existingAccount.id,
      existingAccount.userId,
      "postgres",
      expect.objectContaining({
        label: "Primary DB",
        metadata: existingAccount.metadata,
      }),
    );
  });

  it("does not store Postgres credentials when read-only verification fails", async () => {
    const repository = { insert: vi.fn() };
    const vault = { encrypt: vi.fn() };
    const postgres = {
      assertReadOnlyCredentials: vi.fn(async () => {
        throw new Error("postgres_connection_not_read_only");
      }),
    };
    const service = new ConnectorService(
      repository as never,
      vault as never,
      {} as never,
      postgres as never,
    );

    await expect(service.saveManual({
      userId: "owner@example.com",
      provider: "postgres",
      secret: { connectionUrl: "postgres://admin:password@db.test/app" },
    })).rejects.toThrow(/must be read-only/);
    expect(vault.encrypt).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects an edit owned by another tenant before decrypting it", async () => {
    const repository = {
      findById: vi.fn(async () => ({ ...existingAccount, userId: "someone-else@example.com" })),
    };
    const vault = { decrypt: vi.fn() };
    const service = new ConnectorService(
      repository as never,
      vault as never,
      {} as never,
      {} as never,
    );

    await expect(service.saveManual({
      userId: existingAccount.userId,
      provider: "postgres",
      accountId: existingAccount.id,
      secret: { connectionUrl: "" },
    })).rejects.toThrow("account_not_found_or_not_owned");
    expect(vault.decrypt).not.toHaveBeenCalled();
  });
});
