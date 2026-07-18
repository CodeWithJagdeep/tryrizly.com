import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { ConnectorRepository } from "./connector.repository";
import { ConnectorVaultService } from "./connector-vault.service";
import { MongoIntrospectionService } from "./mongo-introspection.service";
import { PostgresIntrospectionService } from "./postgres-introspection.service";
import type {
  CalComOAuthSecret,
  CompleteOAuthInput,
  CompleteOAuthResult,
  ConnectedAccount,
  ConnectorOAuthProvider,
  ConnectorProvider,
  ConnectorSecretPayload,
  ConnectorSummary,
  DataSourceProvider,
  DataSourceSecretResult,
  GoogleOAuthProvider,
  SaveConnectorInput,
  StartOAuthInput,
} from "./connector.types";
import type { CalComAuth } from "./calcom.service";

const CONNECTOR_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// Identity scopes are needed by both flows just to know which Google account
// completed the consent screen — not a shared connection, each flow still
// gets its own independent token.
const IDENTITY_SCOPES = ["openid", "email", "profile"];

const oauthScopesByProvider: Record<GoogleOAuthProvider, string[]> = {
  gmail: [
    ...IDENTITY_SCOPES,
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/contacts.readonly",
  ],
  calendar: [...IDENTITY_SCOPES, "https://www.googleapis.com/auth/calendar.events"],
};

const calComOAuthScopes = [
  "BOOKING_READ",
  "BOOKING_WRITE",
  "EVENT_TYPE_READ",
  "PROFILE_READ",
];

type CalComOAuthClient = {
  clientId: string;
  /** Absent for a PKCE-only ("public") client — Cal.com's platform OAuth
   * clients created with "Use PKCE" don't issue one at all. */
  clientSecret?: string;
  source: "env" | "custom";
  /** Cal.com's EU data-residency org (cal.eu) is a fully separate instance
   * from the global cal.com one, each with its own approved OAuth client —
   * these travel with the client since they're not independently choosable. */
  appBaseUrl: string;
  apiBaseUrl: string;
};

const CALCOM_REGION_URLS = {
  global: { appBaseUrl: "https://app.cal.com", apiBaseUrl: "https://api.cal.com" },
  eu: { appBaseUrl: "https://app.cal.eu", apiBaseUrl: "https://api.cal.eu" },
} as const;

@Injectable()
export class ConnectorService {
  constructor(
    @Inject(ConnectorRepository)
    private readonly repository: ConnectorRepository,
    @Inject(ConnectorVaultService)
    private readonly vault: ConnectorVaultService,
    @Inject(MongoIntrospectionService)
    private readonly mongoIntrospection: MongoIntrospectionService,
    @Inject(PostgresIntrospectionService)
    private readonly postgresIntrospection: PostgresIntrospectionService,
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

    const existing = input.accountId
      ? await this.repository.findById(input.accountId)
      : undefined;
    if (input.accountId && (!existing || existing.userId !== userId || existing.provider !== provider)) {
      throw new Error("account_not_found_or_not_owned");
    }
    const existingSecret = existing
      ? this.vault.decrypt(existing.encryptedPayload)
      : {};
    const resolvedSecret = mergeConnectorSecrets(existingSecret, input.secret);

    if (provider === "postgres") {
      const connectionUrl = resolvedSecret.connectionUrl;
      if (typeof connectionUrl !== "string" || !connectionUrl.trim()) {
        throw new Error("invalid_connector_payload:postgres");
      }
      resolvedSecret.connectionUrl = connectionUrl.trim();
      try {
        await this.postgresIntrospection.assertReadOnlyCredentials(resolvedSecret.connectionUrl);
      } catch (error) {
        if (error instanceof Error && error.message === "postgres_connection_not_read_only") {
          throw new Error(
            "Postgres credentials must be read-only. Create a login with CONNECT, schema USAGE, and SELECT privileges only.",
          );
        }
        throw new Error(`Couldn't verify the Postgres connection: ${safeConnectionError(error)}`);
      }
    }

    if (provider === "mongodb") {
      const connectionUrl = resolvedSecret.connectionUrl;
      if (typeof connectionUrl !== "string" || !connectionUrl) {
        throw new Error("invalid_connector_payload:mongodb");
      }
      resolvedSecret.connectionUrl = await this.readOnlyMongoConnectionUrl(connectionUrl.trim());
    }

    const encryptedPayload = this.vault.encrypt(resolvedSecret);

    // For multi-account (credential-based) providers, insert a new row per
    // account. For everything else, upsert by (userId, provider) so there's
    // always exactly one. Keep in sync with MULTI_ACCOUNT_PROVIDERS in
    // web/app/dashboard/connectors/connectors-client.tsx.
    const isMultiAccount =
      provider === "postgres" ||
      provider === "mongodb" ||
      provider === "razorpay" ||
      provider === "stripe" ||
      provider === "paypal" ||
      provider === "mpesa" ||
      provider === "calcom";
    let account: ConnectedAccount;

    if (isMultiAccount && input.accountId) {
      // Updating an existing named account.
      const updated = await this.repository.updateOwned(input.accountId, userId, provider, {
          label: input.label ?? providerLabel(provider),
          status: "connected",
          encryptedPayload,
          metadata: { ...existing?.metadata, ...(input.metadata ?? {}) },
        });
      if (!updated) throw new Error("account_not_found_or_not_owned");
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

  /**
   * Accepts whatever credentials the user has on hand (often an admin
   * account) instead of requiring them to hand-roll a read-only user first.
   * If the pasted credentials can already only read, they're used as-is; if
   * they can write, a scoped read-only user is provisioned automatically and
   * that connection is what actually gets stored — the write-capable one
   * passed in here is used once, in memory, and never persisted.
   */
  private async readOnlyMongoConnectionUrl(connectionUrl: string): Promise<string> {
    try {
      await this.mongoIntrospection.assertReadOnly(connectionUrl);
      return connectionUrl;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("mongo_connection_not_read_only")) {
        throw new Error(
          `Couldn't verify the MongoDB connection: ${safeConnectionError(error)}`,
        );
      }
    }

    let readOnlyUrl: string;
    try {
      readOnlyUrl = await this.mongoIntrospection.provisionReadOnlyUser(connectionUrl);
    } catch (error) {
      throw new Error(
        "This MongoDB user can write to your database, and Rizly couldn't automatically create a " +
          `read-only user for you (${safeConnectionError(error)}). Create one manually ` +
          'with: db.createUser({ user: "rizly_readonly", pwd: "<password>", roles: [{ role: "read", db: "<your database name>" }] })',
      );
    }

    // The new user was just created — confirm it actually only reads before trusting it.
    await this.mongoIntrospection.assertReadOnly(readOnlyUrl);
    return readOnlyUrl;
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

  /** Decrypts Cal.com auth for a user. Returns null if not connected or refresh fails. */
  async getCalComSecret(userId: string): Promise<CalComAuth | null> {
    const account = await this.repository.find(userId, "calcom");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);

    if (account.authType === "oauth") {
      const accessToken = stringSecret(payload.accessToken) ?? stringSecret(payload.access_token);
      const refreshToken = stringSecret(payload.refreshToken) ?? stringSecret(payload.refresh_token);
      const expiresAt =
        numberSecret(payload.expiresAt) ??
        numberSecret(payload.expiry_date) ??
        tokenExpiresAt(numberSecret(payload.expires_in));
      const storedRegion = payload.region === "eu" ? "eu" : "global";
      const oauthClient = calComOAuthClientFromPayload(payload) ?? calComOAuthClientFromEnv(storedRegion);

      if (!accessToken) return null;
      if (!refreshToken || !expiresAt || expiresAt > Date.now() + 60_000) {
        return { kind: "oauth", accessToken };
      }

      return oauthClient ? this.refreshCalComOAuth(account, refreshToken, oauthClient, storedRegion) : null;
    }

    const apiKey = stringSecret(payload.apiKey);
    if (!apiKey) return null;
    return { kind: "apikey", apiKey };
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

  /** Decrypts a Notion OAuth/PAT token. Returns null if not connected. */
  async getNotionSecret(userId: string): Promise<{ apiToken: string } | null> {
    const account = await this.repository.find(userId, "notion");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const token = payload.access_token ?? payload.accessToken ?? payload.apiToken;
    if (typeof token !== "string" || !token) return null;
    return { apiToken: token };
  }

  /** Decrypts the Slack bot token. Returns null if not connected. */
  async getSlackSecret(userId: string): Promise<{ botToken: string } | null> {
    const account = await this.repository.find(userId, "slack");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const botToken = payload.botToken;
    if (typeof botToken !== "string" || !botToken) return null;
    return { botToken };
  }

  /** Decrypts Discord read and/or webhook credentials. */
  async getDiscordSecret(userId: string): Promise<{
    webhookUrl?: string;
    botToken?: string;
    channelId?: string;
    guildId?: string;
  } | null> {
    const account = await this.repository.find(userId, "discord");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const webhookUrl = stringSecret(payload.webhookUrl);
    const botToken = stringSecret(payload.botToken);
    const channelId = stringSecret(payload.channelId);
    const guildId = stringSecret(payload.guildId);
    if (!webhookUrl && !(botToken && channelId)) return null;
    return { webhookUrl, botToken, channelId, guildId };
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
    accountId?: string,
  ): Promise<DataSourceSecretResult> {
    const account = accountId
      ? await this.repository.findById(accountId)
      : await this.repository.find(userId, provider);
    if (
      !account
      || account.userId !== userId
      || account.provider !== provider
      || account.status !== "connected"
    ) return { connected: false };

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
    const scopes = scopesForOAuthProvider(input.provider);
    let calComOAuthClient: CalComOAuthClient | undefined;
    let statePayload: Record<string, string> | undefined;
    let codeChallenge: string | undefined;

    if (input.provider === "calcom") {
      const region = input.calComRegion === "eu" ? "eu" : "global";
      const customClientId = stringSecret(input.calComClientId?.trim());
      const customClientSecret = stringSecret(input.calComClientSecret?.trim());
      if ((customClientId && !customClientSecret) || (!customClientId && customClientSecret)) {
        return {
          status: "missing_config" as const,
          message: "Enter both Cal.com OAuth client ID and client secret",
        };
      }
      calComOAuthClient = customClientId && customClientSecret
        ? { clientId: customClientId, clientSecret: customClientSecret, source: "custom", ...CALCOM_REGION_URLS[region] }
        : calComOAuthClientFromEnv(region);

      if (!calComOAuthClient) {
        return {
          status: "missing_config" as const,
          message: `Cal.com OAuth isn't configured for the ${region} region`,
        };
      }

      if (calComOAuthClient.source === "custom" && calComOAuthClient.clientSecret) {
        statePayload = {
          clientId: calComOAuthClient.clientId,
          clientSecret: calComOAuthClient.clientSecret,
          region,
        };
      } else {
        statePayload = { region };
      }

      // Generate a PKCE pair unconditionally: harmless for a confidential
      // client (Cal.com just ignores the extra params), required for a
      // PKCE-only ("public") client, which has no client secret at all.
      const codeVerifier = generateCodeVerifier();
      codeChallenge = codeChallengeFor(codeVerifier);
      statePayload = { ...statePayload, codeVerifier };
    } else {
      const missingConfig = missingOAuthConfig(input.provider);
      if (missingConfig) return missingConfig;
    }

    const userId = input.userId ?? "default";
    const stateId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + CONNECTOR_OAUTH_STATE_TTL_MS);
    await this.repository.createOAuthState({
      stateId,
      userId,
      provider: input.provider,
      returnTo: input.returnTo,
      encryptedPayload: statePayload ? this.vault.encrypt(statePayload) : undefined,
      expiresAt,
    });
    const state = signOAuthState({
      stateId,
      provider: input.provider,
      exp: expiresAt.getTime(),
    });

    const url = authorizationUrlForProvider(input.provider, scopes, state, calComOAuthClient, codeChallenge);

    return {
      status: "connected" as const,
      provider: input.provider,
      authUrl: url.toString(),
      scopes,
    };
  }

  async completeOAuth(input: CompleteOAuthInput): Promise<CompleteOAuthResult> {
    // The real provider comes from the signed state, not the caller. Trusting
    // a provider from an unsigned query/path would let a caller store tokens
    // under the wrong connector row.
    const state = input.state ? verifyOAuthState(input.state) : undefined;
    const provider = state?.provider;
    const scopes = provider ? scopesForOAuthProvider(provider) : undefined;
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

    if (provider === "calcom") {
      const region = regionFromEncryptedState(this.vault, storedState.encryptedPayload);
      const oauthClient =
        calComOAuthClientFromEncryptedState(this.vault, storedState.encryptedPayload) ??
        calComOAuthClientFromEnv(region);
      if (!oauthClient) {
        throw new Error("Cal.com OAuth client credentials are missing");
      }
      const codeVerifier = codeVerifierFromEncryptedState(this.vault, storedState.encryptedPayload);
      return this.completeCalComOAuth({
        code: input.code,
        provider,
        scopes,
        userId,
        returnTo: storedState.returnTo,
        oauthClient,
        codeVerifier,
        region,
      });
    }

    if (provider === "github") {
      return this.completeGitHubOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        scopes,
      });
    }

    if (provider === "notion") {
      return this.completeNotionOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        scopes,
      });
    }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth env vars are missing");
    }

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
    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : undefined;
    const profile = accessToken ? await fetchGoogleProfile(accessToken).catch(() => null) : null;
    const account = await this.repository.upsert({
      userId,
      provider,
      authType: "oauth",
      label: profile?.email ? `${providerLabel(provider)} (${profile.email})` : providerLabel(provider),
      status: "connected",
      encryptedPayload: this.vault.encrypt(tokenJson),
      scopes,
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
        ...(profile?.email ? { accountEmail: profile.email } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: storedState.returnTo };
  }

  private async completeCalComOAuth(input: {
    code: string;
    provider: "calcom";
    scopes: string[];
    userId: string;
    returnTo?: string;
    oauthClient: CalComOAuthClient;
    codeVerifier?: string;
    region: "global" | "eu";
  }): Promise<CompleteOAuthResult> {
    const tokenJson = await exchangeCalComToken({
      clientId: input.oauthClient.clientId,
      clientSecret: input.oauthClient.clientSecret,
      redirectUri: env.CALCOM_REDIRECT_URI,
      grantType: "authorization_code",
      code: input.code,
      codeVerifier: input.codeVerifier,
      apiBaseUrl: input.oauthClient.apiBaseUrl,
    });

    const accessToken = stringSecret(tokenJson.access_token);
    const refreshToken = stringSecret(tokenJson.refresh_token);
    const expiresIn = numberSecret(tokenJson.expires_in) ?? 1800;
    if (!accessToken || !refreshToken) {
      throw new Error("Cal.com token exchange did not return access and refresh tokens");
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    const grantedScopes = splitScopes(stringSecret(tokenJson.scope)) ?? input.scopes;
    const profile = await fetchCalComProfile(accessToken, input.oauthClient.apiBaseUrl).catch(() => null);
    const secret: CalComOAuthSecret = {
      accessToken,
      refreshToken,
      expiresAt,
      region: input.region,
      ...(input.oauthClient.source === "custom"
        ? {
            clientId: input.oauthClient.clientId,
            clientSecret: input.oauthClient.clientSecret,
          }
        : {}),
    };

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: input.provider,
      authType: "oauth",
      label: profile?.email ? `Cal.com (${profile.email})` : providerLabel(input.provider),
      status: "connected",
      encryptedPayload: this.vault.encrypt(secret),
      scopes: grantedScopes,
      metadata: {
        setup: input.oauthClient.source === "custom" ? "custom_oauth" : "oauth",
        hasRefreshToken: true,
        oauthClientSource: input.oauthClient.source,
        tokenExpiresAt: expiresAt,
        ...(profile?.email ? { accountEmail: profile.email } : {}),
        ...(profile?.username ? { accountUsername: profile.username } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeNotionOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    scopes: string[];
  }): Promise<CompleteOAuthResult> {
    const tokenJson = await exchangeNotionToken({
      code: input.code,
      redirectUri: env.NOTION_REDIRECT_URI,
    });

    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Notion token exchange did not return an access token");
    }

    const workspaceName = stringSecret(tokenJson.workspace_name);
    const workspaceId = stringSecret(tokenJson.workspace_id);
    const botId = stringSecret(tokenJson.bot_id);
    const owner = typeof tokenJson.owner === "object" && tokenJson.owner !== null
      ? (tokenJson.owner as Record<string, unknown>)
      : undefined;
    const ownerUser = typeof owner?.user === "object" && owner.user !== null
      ? (owner.user as Record<string, unknown>)
      : undefined;
    const ownerName = stringSecret(ownerUser?.name);

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "notion",
      authType: "oauth",
      label: workspaceName ? `Notion (${workspaceName})` : providerLabel("notion"),
      status: "connected",
      encryptedPayload: this.vault.encrypt(tokenJson),
      scopes: input.scopes,
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceName ? { workspaceName } : {}),
        ...(botId ? { botId } : {}),
        ...(ownerName ? { accountName: ownerName } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeGitHubOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    scopes: string[];
  }): Promise<CompleteOAuthResult> {
    const tokenJson = await exchangeGitHubToken({
      code: input.code,
      redirectUri: env.GITHUB_REDIRECT_URI,
    });

    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("GitHub token exchange did not return an access token");
    }

    const login = await fetchGitHubLogin(accessToken);
    const grantedScopes = splitScopes(stringSecret(tokenJson.scope)?.replace(/,/g, " "));

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "github",
      authType: "oauth",
      label: login ? `GitHub (@${login})` : providerLabel("github"),
      status: "connected",
      // Store under "token" so getGitHubSecret reads OAuth and PAT
      // connections identically.
      encryptedPayload: this.vault.encrypt({ ...tokenJson, token: accessToken }),
      scopes: grantedScopes ?? input.scopes,
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
        ...(login ? { accountUsername: login } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async refreshCalComOAuth(
    account: ConnectedAccount,
    refreshToken: string,
    oauthClient: CalComOAuthClient,
    region: "global" | "eu",
  ): Promise<CalComAuth | null> {
    const tokenJson = await exchangeCalComToken({
      clientId: oauthClient.clientId,
      clientSecret: oauthClient.clientSecret,
      grantType: "refresh_token",
      refreshToken,
      apiBaseUrl: oauthClient.apiBaseUrl,
    }).catch(() => null);
    if (!tokenJson) return null;

    const accessToken = stringSecret(tokenJson.access_token);
    const nextRefreshToken = stringSecret(tokenJson.refresh_token) ?? refreshToken;
    const expiresIn = numberSecret(tokenJson.expires_in) ?? 1800;
    if (!accessToken) return null;

    const expiresAt = Date.now() + expiresIn * 1000;
    const secret: CalComOAuthSecret = {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresAt,
      region,
      ...(oauthClient.source === "custom"
        ? {
            clientId: oauthClient.clientId,
            clientSecret: oauthClient.clientSecret,
          }
        : {}),
    };
    await this.repository.updateById(account.id, {
      encryptedPayload: this.vault.encrypt(secret),
      metadata: {
        ...account.metadata,
        hasRefreshToken: Boolean(nextRefreshToken),
        oauthClientSource: oauthClient.source,
        tokenExpiresAt: expiresAt,
      },
    });

    return { kind: "oauth", accessToken };
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
  provider: ConnectorOAuthProvider;
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
      !isConnectorOAuthProvider(parsed.provider) ||
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

function isConnectorOAuthProvider(value: unknown): value is ConnectorOAuthProvider {
  return value === "gmail" || value === "calendar" || value === "calcom" || value === "notion" || value === "github";
}

function scopesForOAuthProvider(provider: ConnectorOAuthProvider): string[] {
  if (provider === "notion") return [];
  // "repo" is required to see private-repo issues/PRs; classic OAuth apps
  // have no read-only variant of it. The GitHubService still only GETs.
  if (provider === "github") return ["repo", "read:user"];
  return provider === "calcom" ? calComOAuthScopes : oauthScopesByProvider[provider];
}

function missingOAuthConfig(provider: ConnectorOAuthProvider) {
  if (provider === "calcom" && !calComOAuthClientFromEnv()) {
    return {
      status: "missing_config" as const,
      message: "CALCOM_CLIENT_ID and CALCOM_CLIENT_SECRET are missing",
    };
  }

  if (provider === "notion" && (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "NOTION_CLIENT_ID and NOTION_CLIENT_SECRET are missing",
    };
  }

  if (provider === "github" && (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are missing",
    };
  }

  if ((provider === "gmail" || provider === "calendar") && !env.GOOGLE_CLIENT_ID) {
    return {
      status: "missing_config" as const,
      message: "GOOGLE_CLIENT_ID is missing",
    };
  }

  return null;
}

function authorizationUrlForProvider(
  provider: ConnectorOAuthProvider,
  scopes: string[],
  state: string,
  calComOAuthClient?: CalComOAuthClient,
  codeChallenge?: string,
): string {
  if (provider === "notion") {
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("owner", "user");
    url.searchParams.set("client_id", env.NOTION_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.NOTION_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.GITHUB_REDIRECT_URI);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "calcom") {
    const url = new URL("/auth/oauth2/authorize", calComOAuthClient?.appBaseUrl ?? CALCOM_REGION_URLS.global.appBaseUrl);
    url.searchParams.set("client_id", calComOAuthClient?.clientId ?? env.CALCOM_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.CALCOM_REDIRECT_URI);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", scopes.join(" "));
    if (codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

function calComOAuthClientFromEnv(region: "global" | "eu" = "global"): CalComOAuthClient | undefined {
  // A client secret is optional here: Cal.com's platform OAuth clients created
  // with "Use PKCE" (the recommended, non-mobile-only mode too) never issue
  // one — the PKCE code_verifier/code_challenge exchange replaces it.
  const clientId = region === "eu" ? env.CALCOM_EU_CLIENT_ID : env.CALCOM_CLIENT_ID;
  const clientSecret = region === "eu" ? env.CALCOM_EU_CLIENT_SECRET : env.CALCOM_CLIENT_SECRET;
  return clientId
    ? {
        clientId,
        clientSecret: clientSecret || undefined,
        source: "env",
        ...CALCOM_REGION_URLS[region],
      }
    : undefined;
}

function calComOAuthClientFromPayload(
  payload: Record<string, unknown>,
): CalComOAuthClient | undefined {
  const clientId = stringSecret(payload.clientId) ?? stringSecret(payload.client_id);
  const clientSecret = stringSecret(payload.clientSecret) ?? stringSecret(payload.client_secret);
  const region = payload.region === "eu" ? "eu" : "global";
  return clientId
    ? { clientId, clientSecret, source: "custom", ...CALCOM_REGION_URLS[region] }
    : undefined;
}

/** RFC 7636 code_verifier: 43-128 chars from [A-Za-z0-9-._~]. base64url of 32
 * random bytes yields 43 chars, right at the minimum, with no padding to strip. */
function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function codeChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function calComOAuthClientFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): CalComOAuthClient | undefined {
  if (!encryptedPayload) return undefined;
  try {
    return calComOAuthClientFromPayload(vault.decrypt(encryptedPayload));
  } catch {
    return undefined;
  }
}

function codeVerifierFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): string | undefined {
  if (!encryptedPayload) return undefined;
  try {
    return stringSecret(vault.decrypt(encryptedPayload).codeVerifier);
  } catch {
    return undefined;
  }
}

function regionFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): "global" | "eu" {
  if (!encryptedPayload) return "global";
  try {
    return vault.decrypt(encryptedPayload).region === "eu" ? "eu" : "global";
  } catch {
    return "global";
  }
}

type CalComTokenJson = Record<string, string | number | boolean | null>;

async function exchangeCalComToken(
  input:
    | {
        clientId: string;
        clientSecret?: string;
        grantType: "authorization_code";
        code: string;
        redirectUri: string;
        codeVerifier?: string;
        apiBaseUrl: string;
      }
    | {
        clientId: string;
        clientSecret?: string;
        grantType: "refresh_token";
        refreshToken: string;
        apiBaseUrl: string;
      },
): Promise<CalComTokenJson> {
  const body =
    input.grantType === "authorization_code"
      ? {
          client_id: input.clientId,
          ...(input.clientSecret ? { client_secret: input.clientSecret } : {}),
          grant_type: input.grantType,
          code: input.code,
          redirect_uri: input.redirectUri,
          ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}),
        }
      : {
          client_id: input.clientId,
          ...(input.clientSecret ? { client_secret: input.clientSecret } : {}),
          grant_type: input.grantType,
          refresh_token: input.refreshToken,
        };

  const response = await fetch(`${input.apiBaseUrl}/v2/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cal.com token exchange failed: ${errorText}`);
  }

  return (await response.json()) as CalComTokenJson;
}

async function fetchCalComProfile(
  accessToken: string,
  apiBaseUrl: string,
): Promise<{ email?: string; username?: string } | null> {
  const response = await fetch(`${apiBaseUrl}/v2/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: { email?: string; username?: string };
  };
  return payload.data ?? null;
}

async function fetchGoogleProfile(accessToken: string): Promise<{ email?: string } | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { email?: string };
  return payload ?? null;
}

type NotionTokenJson = ConnectorSecretPayload;

async function exchangeNotionToken(input: {
  code: string;
  redirectUri: string;
}): Promise<NotionTokenJson> {
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
    throw new Error("Notion OAuth env vars are missing");
  }

  const credentials = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion token exchange failed: ${errorText}`);
  }

  return (await response.json()) as NotionTokenJson;
}

async function exchangeGitHubToken(input: {
  code: string;
  redirectUri: string;
}): Promise<ConnectorSecretPayload> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error("GitHub OAuth env vars are missing");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub token exchange failed: ${errorText}`);
  }

  const payload = (await response.json()) as ConnectorSecretPayload & { error?: string; error_description?: string };
  // GitHub reports OAuth errors (bad_verification_code, …) with HTTP 200.
  if (typeof payload.error === "string" && payload.error) {
    throw new Error(`GitHub token exchange failed: ${payload.error_description ?? payload.error}`);
  }
  return payload;
}

async function fetchGitHubLogin(accessToken: string): Promise<string | undefined> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) return undefined;
  const user = (await response.json()) as { login?: string };
  return stringSecret(user.login);
}

function stringSecret(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mergeConnectorSecrets(
  existing: ConnectorSecretPayload,
  incoming: ConnectorSecretPayload,
): ConnectorSecretPayload {
  const merged: ConnectorSecretPayload = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      merged[key] = trimmed;
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function safeConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/password authentication|authentication failed|auth failed|bad auth/i.test(message)) {
    return "authentication failed";
  }
  if (/ECONNREFUSED|connection refused/i.test(message)) {
    return "the database host refused the connection";
  }
  if (/ENOTFOUND|getaddrinfo|DNS/i.test(message)) {
    return "the database host could not be resolved";
  }
  if (/timeout|ETIMEDOUT/i.test(message)) return "the connection timed out";
  if (/certificate|TLS|SSL/i.test(message)) return "TLS/SSL validation failed";
  return "the connection could not be established";
}

function numberSecret(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function tokenExpiresAt(expiresIn: number | undefined): number | undefined {
  return expiresIn ? Date.now() + expiresIn * 1000 : undefined;
}

function splitScopes(scope: string | undefined): string[] | undefined {
  const scopes = scope?.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  return scopes && scopes.length > 0 ? scopes : undefined;
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
    discord: "Discord",
  };

  return labels[provider];
}
