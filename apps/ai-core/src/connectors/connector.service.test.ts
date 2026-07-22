import { describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/env", () => ({
  env: {
    STRIPE_APP_CLIENT_ID: "ca_test_rizly",
    STRIPE_APP_SECRET_KEY: "sk_test_app_developer",
    STRIPE_APP_AUTHORIZE_URL: "https://marketplace.stripe.com/oauth/v2/authorize",
    STRIPE_APP_REDIRECT_URI: "https://api.getrizly.com/api/connectors/stripe/callback",
  },
}));

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

describe("ConnectorService Stripe Apps OAuth", () => {
  it("exchanges a signed authorization code and stores rotating tokens encrypted", async () => {
    let storedState: Record<string, unknown> | undefined;
    const repository = {
      createOAuthState: vi.fn(async (state) => { storedState = state; }),
      consumeOAuthState: vi.fn(async () => storedState),
      upsert: vi.fn(async (account) => ({
        ...account,
        id: "stripe-oauth",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      })),
    };
    const vault = {
      encrypt: vi.fn((secret) => JSON.stringify(secret)),
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: "sk_access_one",
      refresh_token: "rt_one",
      stripe_user_id: "acct_rizly_test",
      livemode: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const service = new ConnectorService(
        repository as never,
        vault as never,
        {} as never,
        {} as never,
      );
      const started = await service.startOAuth({
        userId: "owner@example.com",
        provider: "stripe",
        returnTo: "/onboarding?step=4",
      });

      expect(started.status).toBe("connected");
      if (started.status !== "connected") throw new Error("Stripe OAuth did not start");
      const authUrl = new URL(started.authUrl);
      expect(authUrl.searchParams.get("client_id")).toBe("ca_test_rizly");
      expect(authUrl.searchParams.get("redirect_uri"))
        .toBe("https://api.getrizly.com/api/connectors/stripe/callback");

      const completed = await service.completeOAuth({
        code: "ac_one_time",
        state: authUrl.searchParams.get("state") ?? undefined,
      });

      expect(completed).toMatchObject({
        provider: "stripe",
        authType: "oauth",
        returnTo: "/onboarding?step=4",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.stripe.com/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authorization: `Basic ${Buffer.from("sk_test_app_developer:").toString("base64")}`,
          }),
        }),
      );
      expect(vault.encrypt).toHaveBeenLastCalledWith(expect.objectContaining({
        secretKey: "sk_access_one",
        refreshToken: "rt_one",
        stripeAccountId: "acct_rizly_test",
        livemode: false,
      }));
      expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({
        provider: "stripe",
        authType: "oauth",
        label: "Stripe (acct_rizly_test)",
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refreshes an expired access token and persists the rotated refresh token", async () => {
    const account: ConnectedAccount = {
      id: "stripe-oauth",
      userId: "owner@example.com",
      provider: "stripe",
      authType: "oauth",
      label: "Stripe (acct_rizly_test)",
      status: "connected",
      encryptedPayload: "old-ciphertext",
      scopes: [],
      metadata: { setup: "oauth" },
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    const repository = {
      find: vi.fn(async () => account),
      updateById: vi.fn(async () => undefined),
    };
    const vault = {
      decrypt: vi.fn(() => ({
        secretKey: "sk_access_expired",
        refreshToken: "rt_old",
        expiresAt: Date.now() - 1,
        stripeAccountId: "acct_rizly_test",
      })),
      encrypt: vi.fn((secret) => JSON.stringify(secret)),
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: "sk_access_two",
      refresh_token: "rt_two",
      account_id: "acct_rizly_test",
      livemode: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const service = new ConnectorService(
        repository as never,
        vault as never,
        {} as never,
        {} as never,
      );
      const result = await service.getDataSourceSecret(account.userId, "stripe");

      expect(result).toMatchObject({
        connected: true,
        provider: "stripe",
        secret: {
          secretKey: "sk_access_two",
          refreshToken: "rt_two",
          stripeAccountId: "acct_rizly_test",
        },
      });
      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(String(request.body)).toContain("grant_type=refresh_token");
      expect(String(request.body)).toContain("refresh_token=rt_old");
      expect(repository.updateById).toHaveBeenCalledWith(
        account.id,
        expect.objectContaining({ encryptedPayload: expect.any(String) }),
      );
      expect(vault.encrypt).toHaveBeenCalledWith(expect.objectContaining({
        secretKey: "sk_access_two",
        refreshToken: "rt_two",
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
