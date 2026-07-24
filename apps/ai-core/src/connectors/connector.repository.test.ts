import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({ env: {} }));
import { ConnectorRepository } from "./connector.repository";

describe("ConnectorRepository.updateOwned", () => {
  const repositories: ConnectorRepository[] = [];

  afterEach(async () => {
    await Promise.all(
      repositories.splice(0).map((repository) => repository.onModuleDestroy()),
    );
  });

  it("updates only the owning tenant and matching provider", async () => {
    const repository = new ConnectorRepository();
    repositories.push(repository);
    const account = await repository.insert({
      id: crypto.randomUUID(),
      userId: "owner@example.com",
      provider: "postgres",
      authType: "manual",
      label: "Primary",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {},
    });

    await expect(
      repository.updateOwned(account.id, "attacker@example.com", "postgres", {
        label: "Hijacked",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.updateOwned(account.id, "owner@example.com", "mongodb", {
        label: "Wrong provider",
      }),
    ).resolves.toBeUndefined();

    const updated = await repository.updateOwned(
      account.id,
      "owner@example.com",
      "postgres",
      {
        label: "Updated",
      },
    );
    expect(updated?.label).toBe("Updated");
    expect(updated?.userId).toBe("owner@example.com");
  });

  it("deletes every connector owned by one tenant without touching another", async () => {
    const repository = new ConnectorRepository();
    repositories.push(repository);
    const owner = "delete-owner@example.com";
    const other = "delete-other@example.com";
    await repository.insert({
      id: crypto.randomUUID(),
      userId: owner,
      provider: "postgres",
      authType: "manual",
      label: "DB",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {},
    });
    await repository.insert({
      id: crypto.randomUUID(),
      userId: owner,
      provider: "stripe",
      authType: "manual",
      label: "Stripe",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {},
    });
    await repository.insert({
      id: crypto.randomUUID(),
      userId: other,
      provider: "postgres",
      authType: "manual",
      label: "Other DB",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {},
    });

    await expect(repository.deleteAll(owner)).resolves.toBe(2);
    await expect(repository.list(owner)).resolves.toEqual([]);
    await expect(repository.list(other)).resolves.toHaveLength(1);
    await repository.deleteAll(other);
  });

  it("finds a named multi-account connector in the in-memory fallback", async () => {
    const repository = new ConnectorRepository();
    repositories.push(repository);
    const userId = "multi-account@example.com";
    const inserted = await repository.insert({
      id: crypto.randomUUID(),
      userId,
      provider: "stripe",
      authType: "manual",
      label: "US Stripe",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {},
    });

    await expect(repository.find(userId, "stripe")).resolves.toMatchObject({
      id: inserted.id,
    });
    await repository.deleteAll(userId);
  });

  it("resolves Gmail push recipients and advances history monotonically", async () => {
    const repository = new ConnectorRepository();
    repositories.push(repository);
    const userId = `gmail-push-${crypto.randomUUID()}@example.com`;
    const account = await repository.insert({
      id: crypto.randomUUID(),
      userId,
      provider: "gmail",
      authType: "oauth",
      label: "Gmail",
      status: "connected",
      encryptedPayload: "ciphertext",
      scopes: [],
      metadata: {
        accountEmail: "Mailbox@Example.com",
        gmailWatchHistoryId: "100",
      },
    });

    await expect(
      repository.findGmailAccountsByEmail("mailbox@example.com"),
    ).resolves.toEqual([expect.objectContaining({ id: account.id })]);
    await expect(
      repository.advanceGmailHistoryCursor(account.id, userId, "125"),
    ).resolves.toBe(true);
    await expect(
      repository.advanceGmailHistoryCursor(account.id, userId, "120"),
    ).resolves.toBe(false);
    await expect(repository.findById(account.id)).resolves.toMatchObject({
      metadata: expect.objectContaining({ gmailWatchHistoryId: "125" }),
    });
    await repository.deleteAll(userId);
  });
});
