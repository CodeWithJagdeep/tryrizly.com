import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({ env: {} }));
import { ConnectorRepository } from "./connector.repository";

describe("ConnectorRepository.updateOwned", () => {
  const repositories: ConnectorRepository[] = [];

  afterEach(async () => {
    await Promise.all(repositories.splice(0).map((repository) => repository.onModuleDestroy()));
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
      repository.updateOwned(account.id, "attacker@example.com", "postgres", { label: "Hijacked" }),
    ).resolves.toBeUndefined();
    await expect(
      repository.updateOwned(account.id, "owner@example.com", "mongodb", { label: "Wrong provider" }),
    ).resolves.toBeUndefined();

    const updated = await repository.updateOwned(account.id, "owner@example.com", "postgres", {
      label: "Updated",
    });
    expect(updated?.label).toBe("Updated");
    expect(updated?.userId).toBe("owner@example.com");
  });
});
