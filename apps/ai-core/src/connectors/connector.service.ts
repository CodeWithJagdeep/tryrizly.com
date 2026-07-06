import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { ConnectorRepository } from "./connector.repository";
import { ConnectorVaultService } from "./connector-vault.service";
import { MongoIntrospectionService } from "./mongo-introspection.service";
import type {
  CompleteOAuthInput,
  CompleteOAuthResult,
  ConnectedAccount,
  ConnectorProvider,
  ConnectorSummary,
  DataSourceProvider,
  DataSourceSecretResult,
  GoogleOAuthProvider,
  SaveConnectorInput,
  StartOAuthInput,
} from "./connector.types";

const CONNECTOR_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// Identity scopes are needed by both flows just to know which Google account
// completed the consent screen — not a shared connection, each flow still
// gets its own independent token.
const IDENTITY_SCOPES = ["openid", "email", "profile"];

const oauthScopesByProvider: Record<GoogleOAuthProvider, string[]> = {
  gmail: [
    ...IDENTITY_SCOPES,
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/contacts.readonly",
  ],
  calendar: [...IDENTITY_SCOPES, "https://www.googleapis.com/auth/calendar"],
};

@Injectable()
export class ConnectorService {
  constructor(
    @Inject(ConnectorRepository)
    private readonly repository: ConnectorRepository,
    @Inject(ConnectorVaultService)
    private readonly vault: ConnectorVaultService,
    @Inject(MongoIntrospectionService)
    private readonly mongoIntrospection: MongoIntrospectionService,
  ) {}

  async list(userId = "default") {
    const accounts = await this.repository.list(userId);
    return accounts.map((account) => this.toSummary(account));
  }

  listActiveUserIds(provider?: ConnectorProvider | ConnectorProvider[]) {
    return this.repository.listUserIds(provider);
  }

  async saveManual(input: SaveConnectorInput) {
    const userId = input.userId ?? "default";
    const provider = input.provider;

    if (!provider || typeof input.secret !== "object" || input.secret === null) {
      throw new Error("invalid_connector_payload:missing_provider_or_secret");
    }

    if (provider === "mongodb") {
      const connectionUrl = input.secret.connectionUrl;
      if (typeof connectionUrl !== "string" || !connectionUrl) {
        throw new Error("invalid_connector_payload:mongodb");
      }
      try {
        await this.mongoIntrospection.assertReadOnly(connectionUrl);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("mongo_connection_not_read_only")) {
          throw new Error(
            "This MongoDB user can write to your database. Create a read-only user (role: read or readAnyDatabase) and connect with that instead.",
          );
        }
        throw new Error(
          `Couldn't verify that MongoDB connection: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const encryptedPayload = this.vault.encrypt(input.secret);

    // For multi-account providers (postgres/mongodb), insert a new row.
    // For others, upsert by (userId, provider) so there's always exactly one.
    const isMultiAccount = provider === "postgres" || provider === "mongodb";
    let account: ConnectedAccount;

    if (isMultiAccount && input.accountId) {
      // Updating an existing named account.
      await this.repository.updateById(input.accountId, {
        label: input.label ?? providerLabel(provider),
        status: "connected",
        encryptedPayload,
      });
      const updated = await this.repository.findById(input.accountId);
      if (!updated) throw new Error("account_not_found");
      account = updated;
    } else if (isMultiAccount) {
      // Adding a new named account.
      account = await this.repository.insert({
        id: crypto.randomUUID(),
        userId,
        provider,
        authType: input.authType ?? "manual",
        label: input.label ?? providerLabel(provider),
        status: "connected",
        encryptedPayload,
        scopes: input.scopes ?? [],
        metadata: { setup: "manual", ...(input.metadata ?? {}) },
      });
    } else {
      account = await this.repository.upsert({
        userId,
        provider,
        authType: input.authType ?? "manual",
        label: input.label ?? providerLabel(provider),
        status: "connected",
        encryptedPayload,
        scopes: input.scopes ?? [],
        metadata: { setup: "manual", ...(input.metadata ?? {}) },
      });
    }

    return this.toSummary(account);
  }

  async delete(userId = "default", provider: ConnectorProvider) {
    await this.repository.delete(userId, provider);
    return { ok: true };
  }

  async deleteById(userId = "default", id: string) {
    const account = await this.repository.findById(id);
    if (!account || account.userId !== userId) return { ok: false, error: "not_found" };
    await this.repository.deleteById(id);
    return { ok: true, provider: account.provider };
  }

  async updateMetadata(userId = "default", id: string, patch: Record<string, unknown>) {
    const account = await this.repository.findById(id);
    if (!account || account.userId !== userId) return { ok: false, error: "not_found" };
    const merged: ConnectedAccount["metadata"] = {
      ...account.metadata,
      ...(patch as ConnectedAccount["metadata"]),
    };
    await this.repository.updateById(id, { metadata: merged });
    const updated = await this.repository.findById(id);
    return updated ? this.toSummary(updated) : { ok: false, error: "not_found" };
  }

  async isNotificationsEnabled(userId: string, provider: ConnectorProvider): Promise<boolean> {
    const account = await this.repository.find(userId, provider);
    if (!account) return true; // not connected → not our call to gate
    return account.metadata.notificationsEnabled !== false;
  }

  /** Decrypts the Cal.com API key for a user. Returns null if not connected. */
  async getCalComSecret(userId: string): Promise<{ apiKey: string } | null> {
    const account = await this.repository.find(userId, "calcom");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = payload.apiKey;
    if (typeof apiKey !== "string" || !apiKey) return null;
    return { apiKey };
  }

  /** Decrypts the PayPal REST app credentials. Returns null if not connected. */
  async getPayPalSecret(userId: string): Promise<{ clientId: string; clientSecret: string } | null> {
    const account = await this.repository.find(userId, "paypal");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const { clientId, clientSecret } = payload;
    if (typeof clientId !== "string" || !clientId || typeof clientSecret !== "string" || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret };
  }

  /** Decrypts the GitHub personal access token. Returns null if not connected. */
  async getGitHubSecret(userId: string): Promise<{ token: string } | null> {
    const account = await this.repository.find(userId, "github");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const token = payload.token;
    if (typeof token !== "string" || !token) return null;
    return { token };
  }

  /** Decrypts the M-Pesa Daraja credentials. Returns null if not connected. */
  async getMpesaSecret(
    userId: string,
  ): Promise<{ consumerKey: string; consumerSecret: string; shortcode: string; environment: "sandbox" | "production" } | null> {
    const account = await this.repository.find(userId, "mpesa");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const { consumerKey, consumerSecret, shortcode } = payload;
    if (
      typeof consumerKey !== "string" || !consumerKey ||
      typeof consumerSecret !== "string" || !consumerSecret ||
      typeof shortcode !== "string" || !shortcode
    ) {
      return null;
    }
    const environment = payload.environment === "sandbox" ? "sandbox" : "production";
    return { consumerKey, consumerSecret, shortcode, environment };
  }

  /** Returns all named accounts for a provider (for multi-account DB providers). */
  async getAllDataSourceSecrets(
    userId: string,
    provider: DataSourceProvider,
  ): Promise<Array<{ id: string; label: string; connectionUrl: string }>> {
    const accounts = await this.repository.findAll(userId, provider);
    const results: Array<{ id: string; label: string; connectionUrl: string }> = [];
    for (const account of accounts) {
      if (account.status !== "connected") continue;
      const payload = this.vault.decrypt(account.encryptedPayload);
      const connectionUrl = payload.connectionUrl;
      if (typeof connectionUrl === "string" && connectionUrl) {
        results.push({ id: account.id, label: account.label, connectionUrl });
      }
    }
    return results;
  }

  /**
   * Decrypts a manual connector's secret for a known data-source provider.
   * Narrowly typed per call site rather than a generic "any provider" getter —
   * validates the expected keys are present instead of trusting a blind cast,
   * since the stored payload was only ever shape-checked client-side.
   */
  async getDataSourceSecret(
    userId: string,
    provider: DataSourceProvider,
  ): Promise<DataSourceSecretResult> {
    const account = await this.repository.find(userId, provider);
    if (!account) return { connected: false };

    const payload = this.vault.decrypt(account.encryptedPayload);

    if (provider === "postgres") {
      const connectionUrl = payload.connectionUrl;
      if (typeof connectionUrl !== "string" || !connectionUrl) {
        throw new Error(`invalid_connector_payload:${provider}`);
      }
      return { connected: true, provider: "postgres", secret: { connectionUrl } };
    }

    if (provider === "mongodb") {
      const connectionUrl = payload.connectionUrl;
      if (typeof connectionUrl !== "string" || !connectionUrl) {
        throw new Error(`invalid_connector_payload:${provider}`);
      }
      return { connected: true, provider: "mongodb", secret: { connectionUrl } };
    }

    if (provider === "stripe") {
      const secretKey = payload.secretKey;
      if (typeof secretKey !== "string" || !secretKey) {
        throw new Error(`invalid_connector_payload:${provider}`);
      }
      return { connected: true, provider: "stripe", secret: { secretKey } };
    }

    const keyId = payload.keyId;
    const keySecret = payload.keySecret;
    if (typeof keyId !== "string" || !keyId || typeof keySecret !== "string" || !keySecret) {
      throw new Error(`invalid_connector_payload:${provider}`);
    }
    return { connected: true, provider: "razorpay", secret: { keyId, keySecret } };
  }

  async startOAuth(input: StartOAuthInput) {
    const scopes = oauthScopesByProvider[input.provider];
    if (!scopes) {
      throw new Error("Unsupported OAuth provider");
    }

    if (!env.GOOGLE_CLIENT_ID) {
      return {
        status: "missing_config" as const,
        message: "GOOGLE_CLIENT_ID is missing",
      };
    }

    const userId = input.userId ?? "default";
    const stateId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + CONNECTOR_OAUTH_STATE_TTL_MS);
    await this.repository.createOAuthState({
      stateId,
      userId,
      provider: input.provider,
      returnTo: input.returnTo,
      expiresAt,
    });
    const state = signOAuthState({
      stateId,
      provider: input.provider,
      exp: expiresAt.getTime(),
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);

    return {
      status: "connected" as const,
      provider: input.provider,
      authUrl: url.toString(),
      scopes,
    };
  }

  async completeOAuth(input: CompleteOAuthInput): Promise<CompleteOAuthResult> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth env vars are missing");
    }

    // The real provider comes from the signed state, not the caller — Google
    // redirects to one fixed callback URL for both flows, so the path can't
    // carry it, and trusting it from an unsigned param would let a caller
    // store a gmail token under the calendar row (or vice versa).
    const state = input.state ? verifyOAuthState(input.state) : undefined;
    const provider = state?.provider;
    const scopes = provider ? oauthScopesByProvider[provider] : undefined;
    if (!provider || !scopes) {
      throw new Error("Unsupported OAuth provider");
    }

    const storedState = await this.repository.consumeOAuthState(state.stateId, provider);
    if (!storedState) {
      throw new Error("connector_oauth_state_invalid_or_expired");
    }
    if (input.userId && input.userId !== storedState.userId) {
      throw new Error("connector_oauth_state_user_mismatch");
    }
    const userId = storedState.userId;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: input.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${errorText}`);
    }

    const tokenJson = (await tokenResponse.json()) as Record<
      string,
      string | number | boolean | null
    >;
    const account = await this.repository.upsert({
      userId,
      provider,
      authType: "oauth",
      label: providerLabel(provider),
      status: "connected",
      encryptedPayload: this.vault.encrypt(tokenJson),
      scopes,
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
      },
    });

    return { ...this.toSummary(account), returnTo: storedState.returnTo };
  }

  private toSummary(account: ConnectedAccount): ConnectorSummary {
    return {
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      authType: account.authType,
      label: account.label,
      status: account.status,
      scopes: account.scopes,
      metadata: account.metadata,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}

type SignedOAuthState = {
  stateId: string;
  provider: GoogleOAuthProvider;
  exp: number;
};

function signOAuthState(payload: SignedOAuthState): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", oauthStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyOAuthState(value: string): SignedOAuthState | undefined {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return undefined;

  const expected = createHmac("sha256", oauthStateSecret()).update(encoded).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedOAuthState;
    if (
      !parsed.stateId ||
      (parsed.provider !== "gmail" && parsed.provider !== "calendar") ||
      parsed.exp < Date.now()
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function oauthStateSecret(): string {
  const secret = env.AUTH_INTERNAL_SECRET ?? env.CONNECTOR_VAULT_KEY;
  if (!secret && env.NODE_ENV === "production") {
    throw new Error("AUTH_INTERNAL_SECRET or CONNECTOR_VAULT_KEY is required for connector OAuth state");
  }
  return secret ?? "heyriz-local-dev-connector-oauth-state-key";
}

function providerLabel(provider: ConnectorProvider) {
  const labels: Record<ConnectorProvider, string> = {
    google: "Google Gmail + Calendar",
    gmail: "Gmail",
    calendar: "Google Calendar",
    calcom: "Cal.com",
    razorpay: "Razorpay",
    stripe: "Stripe",
    postgres: "Postgres",
    mongodb: "MongoDB",
    slack: "Slack",
    notion: "Notion",
    custom_api: "Custom API",
    telegram: "Telegram",
    paypal: "PayPal",
    github: "GitHub",
    mpesa: "M-Pesa",
  };

  return labels[provider];
}
