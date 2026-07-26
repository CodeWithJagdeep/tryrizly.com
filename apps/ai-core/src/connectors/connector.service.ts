import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { ConnectorRepository } from "./connector.repository";
import { ConnectorVaultService } from "./connector-vault.service";
import { MongoIntrospectionService } from "./mongo-introspection.service";
import { PostgresIntrospectionService } from "./postgres-introspection.service";
import type {
  CalComOAuthSecret,
  CalendlyConnectorSecret,
  CompleteOAuthInput,
  CompleteOAuthResult,
  ConnectedAccount,
  ConnectorOAuthProvider,
  ConnectorProvider,
  ConnectorSecretPayload,
  ConnectorStatus,
  ConnectorSummary,
  DataSourceProvider,
  DataSourceSecretResult,
  GoogleOAuthProvider,
  JiraConnectorSecret,
  SaveConnectorInput,
  StartOAuthInput,
  StripeConnectorSecret,
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
  // Deliberately narrow: drive.file only grants access to files Rizly itself
  // creates (no broad Drive read/list) — keeps this off Google's "restricted
  // scope" security-assessment track. spreadsheets/documents are "sensitive"
  // (standard verification only) since Sheets/Docs have no file-scoped analog.
  google_workspace: [
    ...IDENTITY_SCOPES,
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
  ],
};

// Reduced scope sets for connections initiated from the automation builder.
// Automations only ever *read* Gmail (the "New Email Matching Search" trigger —
// there's no live Gmail action), so read-only is all that's required; send and
// contacts are assistant-only. Providers not listed here fall back to the full
// set above (Calendar automations can create Meet events; Workspace file scopes
// are already narrow). Requested with include_granted_scopes so a user who
// already granted the assistant more never gets downgraded.
const automationOauthScopesByProvider: Partial<Record<GoogleOAuthProvider, string[]>> = {
  gmail: [...IDENTITY_SCOPES, "https://www.googleapis.com/auth/gmail.readonly"],
};

const calComOAuthScopes = [
  "BOOKING_READ",
  "BOOKING_WRITE",
  "EVENT_TYPE_READ",
  "PROFILE_READ",
];

// Stripe Apps permissions are granted through stripe-app.json rather than an
// OAuth `scope` query parameter. Keep them here as connection metadata so the
// dashboard can accurately show what Rizly requested.
const STRIPE_APP_PERMISSIONS = [
  "balance_transaction_source_read",
  "charge_read",
  "customer_read",
  "invoice_read",
  "payment_intent_read",
  "subscription_read",
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

    // Manual push-webhook connectors: registering the webhook (or, for
    // Gumroad/UptimeRobot which have no registration API, capturing the
    // identity needed to resolve one) has to happen here, at save time —
    // it's the only moment we hold the user's freshly-pasted token in memory.
    const webhookMetadata: Record<string, string> = {};
    if (provider === "calendly") await this.prepareCalendlyManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "typeform") await this.prepareTypeformManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "gumroad") await this.prepareGumroadManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "lemonsqueezy") await this.prepareLemonSqueezyManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "uptimerobot") await this.prepareUptimeRobotManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "wise") await this.prepareWiseManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "bamboohr") await this.prepareBambooHrManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "statuspage") await this.prepareStatuspageManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "betterstack") await this.prepareBetterStackManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "stripe") await this.prepareStripeManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "razorpay") await this.prepareRazorpayManualConnect(resolvedSecret, webhookMetadata);
    if (provider === "paypal") await this.preparePayPalManualConnect(resolvedSecret, webhookMetadata);

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
          metadata: { ...existing?.metadata, ...webhookMetadata, ...(input.metadata ?? {}) },
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
        metadata: { setup: "manual", ...webhookMetadata, ...(input.metadata ?? {}) },
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
        metadata: { setup: "manual", ...webhookMetadata, ...(input.metadata ?? {}) },
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

  /**
   * Registers a Calendly webhook subscription (scope "user") using the
   * pasted token, and fetches /users/me so incoming events (which carry an
   * organization URI, not a userId) can be resolved back to this account —
   * see ConnectorService.resolveCalendlyOrganizationUsers.
   */
  private async prepareCalendlyManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const apiToken = stringSecret(secret.apiToken);
    if (!apiToken) throw new Error("invalid_connector_payload:calendly");

    const registration = await this.registerCalendlyWebhook(apiToken);
    secret.userUri = registration.userUri;
    secret.organizationUri = registration.organizationUri;
    secret.webhookSigningKey = registration.webhookSigningKey ?? null;
    secret.webhookSubscriptionUri = registration.webhookSubscriptionUri ?? null;
    metadata.organizationUri = registration.organizationUri;
  }

  /**
   * Registers a Calendly webhook subscription (scope "user") using whichever
   * token the account authenticates with — a pasted Personal Access Token or
   * an OAuth access token, both accepted the same way by Calendly's API —
   * and fetches /users/me so incoming events (which carry an organization
   * URI, not a userId) can be resolved back to this account. See
   * ConnectorService.resolveCalendlyOrganizationUsers.
   */
  private async registerCalendlyWebhook(token: string): Promise<{
    userUri: string;
    organizationUri: string;
    webhookSigningKey?: string;
    webhookSubscriptionUri?: string | null;
  }> {
    const me = await fetch("https://api.calendly.com/users/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!me.ok) throw new Error("Couldn't verify Calendly access");
    const meJson = (await me.json()) as { resource?: { uri?: string; current_organization?: string } };
    const userUri = meJson.resource?.uri;
    const organizationUri = meJson.resource?.current_organization;
    if (!userUri || !organizationUri) throw new Error("Calendly did not return a user/organization URI");

    // Calendly requires a publicly reachable HTTPS callback URL for webhook
    // subscriptions — this rejects with an "invalid url" error whenever
    // NEXT_PUBLIC_GATEWAY_URL is localhost (local dev with no tunnel). Treat
    // that as non-fatal: the connection still completes and calendly_events
    // still works: booking/cancellation triggers just won't fire until this
    // is reconnected somewhere with a public URL (prod, or a dev tunnel).
    try {
      const subscription = await fetch("https://api.calendly.com/webhook_subscriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/calendly/webhook`,
          events: ["invitee.created", "invitee.canceled"],
          organization: organizationUri,
          user: userUri,
          scope: "user",
        }),
      });
      if (!subscription.ok) {
        throw new Error(`Couldn't register the Calendly webhook: ${await subscription.text()}`);
      }
      const subscriptionJson = (await subscription.json()) as {
        resource?: { uri?: string; signing_key?: string };
      };
      const webhookSigningKey = subscriptionJson.resource?.signing_key;
      if (!webhookSigningKey) throw new Error("Calendly did not return a webhook signing key");

      return {
        userUri,
        organizationUri,
        webhookSigningKey,
        webhookSubscriptionUri: subscriptionJson.resource?.uri ?? null,
      };
    } catch (error) {
      logger.warn("calendly webhook registration failed; connecting without live triggers", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { userUri, organizationUri };
    }
  }

  private async completeCalendlyOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.CALENDLY_CLIENT_ID || !env.CALENDLY_CLIENT_SECRET) {
      throw new Error("Calendly OAuth env vars are missing");
    }
    const response = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.CALENDLY_CLIENT_ID,
        client_secret: env.CALENDLY_CLIENT_SECRET,
        code: input.code,
        redirect_uri: env.CALENDLY_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Calendly token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Calendly token exchange did not return an access token");
    }

    const registration = await this.registerCalendlyWebhook(accessToken);

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "calendly",
      authType: "oauth",
      label: providerLabel("calendly"),
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresAt: tokenExpiresAt(numberSecret(tokenJson.expires_in)) ?? null,
        userUri: registration.userUri,
        organizationUri: registration.organizationUri,
        webhookSigningKey: registration.webhookSigningKey ?? null,
        webhookSubscriptionUri: registration.webhookSubscriptionUri ?? null,
      }),
      scopes: scopesForOAuthProvider("calendly"),
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
        organizationUri: registration.organizationUri,
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  /**
   * Typeform has a registration API, but only per-form (PUT
   * /forms/{id}/webhooks/{tag}) — there's no "all my forms" webhook, so a
   * formId is required here even though the trigger-config field is
   * documented as optional (it only scopes *which flows* react, not whether
   * the webhook exists at all).
   */
  private async prepareTypeformManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const apiToken = stringSecret(secret.apiToken);
    const formId = stringSecret(secret.formId);
    if (!apiToken || !formId) {
      throw new Error("invalid_connector_payload:typeform — apiToken and formId are both required to register a webhook");
    }

    const webhookSecret = randomBytes(24).toString("hex");
    const response = await fetch(
      `https://api.typeform.com/forms/${encodeURIComponent(formId)}/webhooks/rizly`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/typeform/webhook`,
          enabled: true,
          secret: webhookSecret,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Couldn't register the Typeform webhook: ${await response.text()}`);
    }

    secret.webhookSecret = webhookSecret;
    metadata.formId = formId;
  }

  /**
   * Gumroad has no webhook-registration API — the user adds the ping URL
   * manually under Settings -> Advanced. All we can do here is capture the
   * sellerId so an incoming (unsigned) ping can be matched to this account.
   */
  private async prepareGumroadManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const accessToken = stringSecret(secret.accessToken);
    if (!accessToken) throw new Error("invalid_connector_payload:gumroad");

    const response = await fetch(`https://api.gumroad.com/v2/user?access_token=${encodeURIComponent(accessToken)}`);
    if (!response.ok) throw new Error("Couldn't verify the Gumroad access token");
    const json = (await response.json()) as { user?: { id?: string } };
    const sellerId = json.user?.id;
    if (!sellerId) throw new Error("Gumroad did not return a seller id");

    secret.sellerId = sellerId;
    metadata.sellerId = sellerId;
  }

  /** Registers a Lemon Squeezy webhook for "order_created" and stores the secret it returns for X-Signature verification. */
  private async prepareLemonSqueezyManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const apiKey = stringSecret(secret.apiKey);
    const storeId = stringSecret(secret.storeId);
    if (!apiKey || !storeId) {
      throw new Error("invalid_connector_payload:lemonsqueezy — apiKey and storeId are both required to register a webhook");
    }

    const webhookSecret = randomBytes(24).toString("hex");
    const response = await fetch("https://api.lemonsqueezy.com/v1/webhooks", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "webhooks",
          attributes: {
            url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/lemonsqueezy/webhook`,
            events: ["order_created"],
            secret: webhookSecret,
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Couldn't register the Lemon Squeezy webhook: ${await response.text()}`);
    }

    secret.webhookSecret = webhookSecret;
    metadata.storeId = storeId;
  }

  /** No registration API exists for UptimeRobot alert-contact webhooks — we just mint the secret the user has to paste into their own Alert Contact URL. */
  private async prepareUptimeRobotManualConnect(
    secret: ConnectorSecretPayload,
    _metadata: Record<string, string>,
  ): Promise<void> {
    const apiKey = stringSecret(secret.apiKey);
    if (!apiKey) throw new Error("invalid_connector_payload:uptimerobot");
    secret.webhookSecret = randomBytes(24).toString("hex");
  }

  /**
   * Registers a Wise webhook subscription for "balances#credit". Wise signs
   * webhooks with an RSA keypair, not HMAC, so there's no shared secret to
   * generate here — verification instead fetches Wise's public key at
   * receive time (see WiseWebhookAuthService).
   */
  private async prepareWiseManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const apiToken = stringSecret(secret.apiToken);
    const profileId = stringSecret(secret.profileId);
    if (!apiToken || !profileId) {
      throw new Error("invalid_connector_payload:wise — apiToken and profileId are both required to register a webhook");
    }

    const response = await fetch(`https://api.wise.com/v3/profiles/${encodeURIComponent(profileId)}/webhooks/subscriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Rizly balance credit",
        trigger_on: "balances#credit",
        delivery: {
          version: "2.0.0",
          url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/wise/webhook`,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Couldn't register the Wise webhook: ${await response.text()}`);
    }
    const json = (await response.json().catch(() => ({}))) as { id?: string };

    secret.webhookSubscriptionId = json.id ?? null;
    metadata.profileId = profileId;
  }

  /** No webhook — BambooHR is poll-only (see SchedulerService.pollOneAutomation). Just validates the credentials work. */
  private async prepareBambooHrManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const subdomain = stringSecret(secret.subdomain);
    const apiKey = stringSecret(secret.apiKey);
    if (!subdomain || !apiKey) throw new Error("invalid_connector_payload:bamboohr");

    const auth = Buffer.from(`${apiKey}:x`).toString("base64");
    const response = await fetch(
      `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1/meta/fields`,
      { headers: { authorization: `Basic ${auth}`, accept: "application/json" } },
    );
    if (!response.ok) throw new Error("Couldn't verify the BambooHR subdomain/API key");
    metadata.subdomain = subdomain;
  }

  /**
   * Statuspage subscriber webhooks have no signature support at all — the
   * generated webhookSecret is a query-param shared secret the user pastes
   * into the subscribe URL, same pattern as UptimeRobot. If an API key is
   * also provided we register the subscription directly via Statuspage's
   * Admin API; otherwise the user has to subscribe the URL by hand via the
   * page's public subscribe form (documented on the connectors page).
   */
  private async prepareStatuspageManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const pageId = stringSecret(secret.pageId);
    if (!pageId) throw new Error("invalid_connector_payload:statuspage");
    const webhookSecret = randomBytes(24).toString("hex");
    secret.webhookSecret = webhookSecret;
    metadata.pageId = pageId;

    const apiKey = stringSecret(secret.apiKey);
    if (!apiKey) return; // manual subscribe-form step required instead

    const endpoint = `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/statuspage/webhook?secret=${webhookSecret}`;
    const response = await fetch(`https://api.statuspage.io/v1/pages/${encodeURIComponent(pageId)}/subscribers`, {
      method: "POST",
      headers: { authorization: `OAuth ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ subscriber: { endpoint, type: "webhook" } }),
    });
    if (!response.ok) {
      logger.warn("statuspage subscriber registration failed — falling back to manual subscribe-form step", {
        status: response.status,
      });
    }
  }

  /** No registration API — the user creates a webhook integration in Better Stack by hand pointing at the generated secret URL. */
  private async prepareBetterStackManualConnect(
    secret: ConnectorSecretPayload,
    _metadata: Record<string, string>,
  ): Promise<void> {
    const apiKey = stringSecret(secret.apiKey);
    if (!apiKey) throw new Error("invalid_connector_payload:betterstack");
    secret.webhookSecret = randomBytes(24).toString("hex");
  }

  async delete(userId = "default", provider: ConnectorProvider) {
    if (provider === "figma") {
      const account = await this.repository.find(userId, "figma");
      if (account) await this.cleanupFigmaWebhook(account);
    }
    if (provider === "box") {
      const account = await this.repository.find(userId, "box");
      if (account) await this.cleanupBoxWebhook(account);
    }
    if (provider === "wise") {
      const account = await this.repository.find(userId, "wise");
      if (account) await this.cleanupWiseWebhook(account);
    }
    await this.repository.delete(userId, provider);
    return { ok: true };
  }

  async deleteById(userId = "default", id: string) {
    const account = await this.repository.findById(id);
    if (!account || account.userId !== userId) return { ok: false, error: "not_found" };
    if (account.provider === "figma") await this.cleanupFigmaWebhook(account);
    if (account.provider === "box") await this.cleanupBoxWebhook(account);
    if (account.provider === "wise") await this.cleanupWiseWebhook(account);
    await this.repository.deleteById(id);
    return { ok: true, provider: account.provider };
  }

  /** Best-effort: don't let a Figma API hiccup block disconnecting the account here — an orphaned webhook is a minor annoyance, a stuck connector is worse. */
  private async cleanupFigmaWebhook(account: ConnectedAccount): Promise<void> {
    try {
      const secret = this.vault.decrypt(account.encryptedPayload);
      const accessToken = stringSecret(secret.accessToken);
      const webhookId = stringSecret(secret.webhookId);
      if (!accessToken || !webhookId) return;
      const response = await fetch(`https://api.figma.com/v2/webhooks/${encodeURIComponent(webhookId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        logger.warn("figma webhook cleanup failed", { webhookId, status: response.status });
      }
    } catch (error) {
      logger.warn("figma webhook cleanup threw", { error: safeConnectionError(error) });
    }
  }

  /** Best-effort: an orphaned Box webhook is a minor annoyance, a stuck connector is worse. */
  private async cleanupBoxWebhook(account: ConnectedAccount): Promise<void> {
    try {
      const secret = this.vault.decrypt(account.encryptedPayload);
      const accessToken = stringSecret(secret.accessToken);
      const webhookId = stringSecret(secret.webhookId);
      if (!accessToken || !webhookId) return;
      const response = await fetch(`https://api.box.com/2.0/webhooks/${encodeURIComponent(webhookId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        logger.warn("box webhook cleanup failed", { webhookId, status: response.status });
      }
    } catch (error) {
      logger.warn("box webhook cleanup threw", { error: safeConnectionError(error) });
    }
  }

  /** Best-effort: an orphaned Wise webhook subscription is a minor annoyance, a stuck connector is worse. */
  private async cleanupWiseWebhook(account: ConnectedAccount): Promise<void> {
    try {
      const secret = this.vault.decrypt(account.encryptedPayload);
      const apiToken = stringSecret(secret.apiToken);
      const profileId = stringSecret(secret.profileId);
      const subscriptionId = stringSecret(secret.webhookSubscriptionId);
      if (!apiToken || !profileId || !subscriptionId) return;
      const response = await fetch(
        `https://api.wise.com/v3/profiles/${encodeURIComponent(profileId)}/webhooks/subscriptions/${encodeURIComponent(subscriptionId)}`,
        { method: "DELETE", headers: { authorization: `Bearer ${apiToken}` } },
      );
      if (!response.ok) {
        logger.warn("wise webhook cleanup failed", { subscriptionId, status: response.status });
      }
    } catch (error) {
      logger.warn("wise webhook cleanup threw", { error: safeConnectionError(error) });
    }
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

  /**
   * Whether Riz may read & AI-summarise this account's inbox in the background
   * (the connectors page "Auto-process emails" toggle). Gates the email poll
   * itself so turning it off stops the *reading*, not just the notification.
   */
  async isAutoProcessEnabled(userId: string, provider: ConnectorProvider): Promise<boolean> {
    const account = await this.repository.find(userId, provider);
    if (!account) return false; // not connected → nothing to process
    return account.metadata.autoProcess !== false;
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

  /** Which of our userIds have this Notion workspace connected — for routing an incoming webhook event to the right principal(s). */
  async resolveNotionWorkspaceUsers(workspaceId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndWorkspace("notion", workspaceId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts a Shopify custom-app access token. Returns null if not connected. */
  async getShopifySecret(userId: string): Promise<{ shopDomain: string; accessToken: string } | null> {
    const account = await this.repository.find(userId, "shopify");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const shopDomain = stringSecret(payload.shopDomain);
    const accessToken = stringSecret(payload.accessToken);
    if (!shopDomain || !accessToken) return null;
    return { shopDomain, accessToken };
  }

  /** Which of our userIds have this Shopify shop connected — webhooks carry the shop domain, not a userId. */
  async resolveShopifyShopUsers(shopDomain: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("shopify", "shopDomain", shopDomain);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts Calendly credentials — either the OAuth shape (accessToken) or the manual Personal Access Token shape (apiToken). calendly.service.ts branches on which is present. Returns null if not connected. */
  async getCalendlySecret(userId: string): Promise<CalendlyConnectorSecret | null> {
    const account = await this.repository.find(userId, "calendly");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiToken = stringSecret(payload.apiToken);
    const accessToken = stringSecret(payload.accessToken);
    if (!apiToken && !accessToken) return null;
    return {
      apiToken,
      accessToken,
      refreshToken: stringSecret(payload.refreshToken),
      userUri: stringSecret(payload.userUri),
      organizationUri: stringSecret(payload.organizationUri),
    };
  }

  /** Which of our userIds registered a webhook subscription for this Calendly organization. */
  async resolveCalendlyOrganizationUsers(organizationUri: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("calendly", "organizationUri", organizationUri);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Calendly webhook signing key for a given organizationUri, for signature verification. */
  async getCalendlySigningKey(organizationUri: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("calendly", "organizationUri", organizationUri);
    for (const account of accounts) {
      const key = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSigningKey);
      if (key) return key;
    }
    return undefined;
  }

  /** Decrypts a Typeform Personal Access Token. Returns null if not connected. */
  async getTypeformSecret(userId: string): Promise<{ apiToken: string; formId?: string } | null> {
    const account = await this.repository.find(userId, "typeform");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiToken = stringSecret(payload.apiToken);
    if (!apiToken) return null;
    return { apiToken, formId: stringSecret(payload.formId) };
  }

  /** Which of our userIds scoped their Typeform connection to this form — resolution requires a stored formId (see connect-time note in gateway's typeform-webhook-auth.service.ts). */
  async resolveTypeformFormUsers(formId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("typeform", "formId", formId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Typeform webhook secret for a given formId, for signature verification. */
  async getTypeformWebhookSecret(formId: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("typeform", "formId", formId);
    for (const account of accounts) {
      const secret = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSecret);
      if (secret) return secret;
    }
    return undefined;
  }

  /** Decrypts a Gumroad access token. Returns null if not connected. */
  async getGumroadSecret(userId: string): Promise<{ accessToken: string; sellerId?: string } | null> {
    const account = await this.repository.find(userId, "gumroad");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    if (!accessToken) return null;
    return { accessToken, sellerId: stringSecret(payload.sellerId) };
  }

  /** Which of our userIds' stored sellerId matches a Gumroad ping — the only identity check available (Gumroad pings are unsigned). */
  async resolveGumroadSellerUsers(sellerId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("gumroad", "sellerId", sellerId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts a Lemon Squeezy API key. Returns null if not connected. */
  async getLemonSqueezySecret(userId: string): Promise<{ apiKey: string; storeId?: string; webhookSecret?: string } | null> {
    const account = await this.repository.find(userId, "lemonsqueezy");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = stringSecret(payload.apiKey);
    if (!apiKey) return null;
    return { apiKey, storeId: stringSecret(payload.storeId), webhookSecret: stringSecret(payload.webhookSecret) };
  }

  /** Which of our userIds connected this Lemon Squeezy store — also returns the stored webhook secret needed to verify X-Signature. */
  async resolveLemonSqueezyStoreUsers(storeId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("lemonsqueezy", "storeId", storeId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Lemon Squeezy webhook secret for a given storeId, for signature verification before the event is trusted enough to resolve/dispatch. */
  async getLemonSqueezyWebhookSecret(storeId: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("lemonsqueezy", "storeId", storeId);
    for (const account of accounts) {
      const secret = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSecret);
      if (secret) return secret;
    }
    return undefined;
  }

  /** Decrypts Dropbox OAuth credentials. Returns null if not connected. */
  async getDropboxSecret(userId: string): Promise<{ accessToken: string; accountId: string } | null> {
    const account = await this.repository.find(userId, "dropbox");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    const accountId = stringSecret(payload.accountId);
    if (!accessToken || !accountId) return null;
    return { accessToken, accountId };
  }

  /** All connected Dropbox accounts matching a given Dropbox accountId, with their stored delta cursor — a webhook notification can list several accountIds at once and (rarely) more than one Rizly user could connect the same Dropbox account. */
  async getDropboxAccountsByAccountId(
    accountId: string,
  ): Promise<Array<{ userId: string; accessToken: string; cursor?: string }>> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("dropbox", "accountId", accountId);
    const results: Array<{ userId: string; accessToken: string; cursor?: string }> = [];
    for (const account of accounts) {
      const payload = this.vault.decrypt(account.encryptedPayload);
      const accessToken = stringSecret(payload.accessToken);
      if (!accessToken) continue;
      results.push({
        userId: account.userId,
        accessToken,
        cursor: typeof account.metadata.dropboxCursor === "string" ? account.metadata.dropboxCursor : undefined,
      });
    }
    return results;
  }

  /** Persists the Dropbox delta cursor so the next webhook only pulls what changed since. */
  async setDropboxCursor(userId: string, cursor: string): Promise<void> {
    const account = await this.repository.find(userId, "dropbox");
    if (!account) return;
    await this.repository.updateById(account.id, { metadata: { ...account.metadata, dropboxCursor: cursor } });
  }

  /** Decrypts Figma OAuth credentials. Returns null if not connected. */
  async getFigmaSecret(userId: string): Promise<{ accessToken: string; teamId?: string } | null> {
    const account = await this.repository.find(userId, "figma");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    if (!accessToken) return null;
    return { accessToken, teamId: stringSecret(payload.teamId) };
  }

  /** Which of our userIds registered a webhook for this Figma team. */
  async resolveFigmaTeamUsers(teamId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("figma", "teamId", teamId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Figma webhook passcode for a given teamId, for signature verification. */
  async getFigmaWebhookPasscode(teamId: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("figma", "teamId", teamId);
    for (const account of accounts) {
      const passcode = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookPasscode);
      if (passcode) return passcode;
    }
    return undefined;
  }

  /** Decrypts UptimeRobot API-key credentials. Returns null if not connected. */
  async getUptimeRobotSecret(userId: string): Promise<{ apiKey: string; webhookSecret: string } | null> {
    const account = await this.repository.find(userId, "uptimerobot");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = stringSecret(payload.apiKey);
    const webhookSecret = stringSecret(payload.webhookSecret);
    if (!apiKey || !webhookSecret) return null;
    return { apiKey, webhookSecret };
  }

  /**
   * UptimeRobot has no HMAC signing, so the query-param secret the user
   * pastes into their Alert Contact URL IS both the identity lookup and the
   * verification — the first (and only) account whose stored webhookSecret
   * safeEqual-matches the incoming one is who the alert belongs to.
   */
  async resolveUptimeRobotWebhookSecret(secret: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProvider("uptimerobot");
    for (const account of accounts) {
      const stored = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSecret);
      if (stored && safeEqual(stored, secret)) return account.userId;
    }
    return undefined;
  }

  /** Decrypts QuickBooks OAuth credentials. Returns null if not connected. */
  async getQuickBooksSecret(userId: string): Promise<{ accessToken: string; refreshToken: string; realmId: string } | null> {
    const account = await this.repository.find(userId, "quickbooks");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    const refreshToken = stringSecret(payload.refreshToken);
    const realmId = stringSecret(payload.realmId);
    if (!accessToken || !refreshToken || !realmId) return null;
    return { accessToken, refreshToken, realmId };
  }

  /** Which of our userIds connected this QuickBooks company (realmId). */
  async resolveQuickBooksRealmUsers(realmId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("quickbooks", "realmId", realmId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts Xero OAuth credentials. Returns null if not connected. */
  async getXeroSecret(userId: string): Promise<{ accessToken: string; refreshToken: string; tenantId: string } | null> {
    const account = await this.repository.find(userId, "xero");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    const refreshToken = stringSecret(payload.refreshToken);
    const tenantId = stringSecret(payload.tenantId);
    if (!accessToken || !refreshToken || !tenantId) return null;
    return { accessToken, refreshToken, tenantId };
  }

  /** Which of our userIds connected this Xero tenant. */
  async resolveXeroTenantUsers(tenantId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("xero", "tenantId", tenantId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts Wise API-token credentials. Returns null if not connected. */
  async getWiseSecret(userId: string): Promise<{ apiToken: string; profileId: string } | null> {
    const account = await this.repository.find(userId, "wise");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiToken = stringSecret(payload.apiToken);
    const profileId = stringSecret(payload.profileId);
    if (!apiToken || !profileId) return null;
    return { apiToken, profileId };
  }

  /** Which of our userIds registered a webhook for this Wise profile. */
  async resolveWiseProfileUsers(profileId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("wise", "profileId", profileId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts BambooHR subdomain + API key credentials. Returns null if not connected. */
  async getBambooHrSecret(userId: string): Promise<{ subdomain: string; apiKey: string } | null> {
    const account = await this.repository.find(userId, "bamboohr");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const subdomain = stringSecret(payload.subdomain);
    const apiKey = stringSecret(payload.apiKey);
    if (!subdomain || !apiKey) return null;
    return { subdomain, apiKey };
  }

  /** Decrypts Deel OAuth credentials. Returns null if not connected. */
  async getDeelSecret(userId: string): Promise<{ accessToken: string } | null> {
    const account = await this.repository.find(userId, "deel");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    if (!accessToken) return null;
    return { accessToken };
  }

  /** Deel webhook signing key for a given organizationId, for signature verification — mirrors getCalendlySigningKey. */
  async getDeelSigningKey(organizationId: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("deel", "organizationId", organizationId);
    for (const account of accounts) {
      const key = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSigningSecret);
      if (key) return key;
    }
    return undefined;
  }

  /** Which of our userIds registered a webhook subscription for this Deel organization — mirrors resolveCalendlyOrganizationUsers. */
  async resolveDeelOrganizationUsers(organizationId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("deel", "organizationId", organizationId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Decrypts Box OAuth credentials. Returns null if not connected. */
  async getBoxSecret(userId: string): Promise<{ accessToken: string; folderId: string } | null> {
    const account = await this.repository.find(userId, "box");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accessToken = stringSecret(payload.accessToken);
    const folderId = stringSecret(payload.folderId);
    if (!accessToken || !folderId) return null;
    return { accessToken, folderId };
  }

  /** Which of our userIds registered a webhook for this Box folder. */
  async resolveBoxFolderUsers(folderId: string): Promise<string[]> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("box", "folderId", folderId);
    return [...new Set(accounts.map((a) => a.userId))];
  }

  /** Box's two signing keys, for a given folderId — key rotation means either may be the currently-active one. */
  async getBoxSignatureKeys(folderId: string): Promise<{ primary?: string; secondary?: string } | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("box", "folderId", folderId);
    for (const account of accounts) {
      const payload = this.vault.decrypt(account.encryptedPayload);
      const primary = stringSecret(payload.primarySignatureKey);
      const secondary = stringSecret(payload.secondarySignatureKey);
      if (primary || secondary) return { primary, secondary };
    }
    return undefined;
  }

  /**
   * Statuspage/Better Stack have no HMAC signing, so the query-param secret
   * pasted into the webhook URL IS both identity and verification — same
   * pattern as resolveUptimeRobotWebhookSecret.
   */
  async resolveStatuspageWebhookSecret(secret: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProvider("statuspage");
    for (const account of accounts) {
      const stored = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSecret);
      if (stored && safeEqual(stored, secret)) return account.userId;
    }
    return undefined;
  }

  async resolveBetterStackWebhookSecret(secret: string): Promise<string | undefined> {
    const accounts = await this.repository.findAllByProvider("betterstack");
    for (const account of accounts) {
      const stored = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSecret);
      if (stored && safeEqual(stored, secret)) return account.userId;
    }
    return undefined;
  }

  /**
   * Registers a Stripe webhook_endpoint for charge.succeeded/charge.failed/
   * customer.subscription.created and stores the `secret` (whsec_...) Stripe
   * hands back for Stripe-Signature verification. If this is a Stripe Connect
   * connection (stripeAccountId present), the endpoint is created scoped to
   * that connected account via the Stripe-Account header — otherwise it's a
   * plain platform-account endpoint for a manual secret key. Non-fatal on
   * failure (e.g. a localhost NEXT_PUBLIC_GATEWAY_URL in local dev, which
   * Stripe rejects as an invalid callback url) — same treatment as Calendly:
   * the connection still completes, just without live triggers until
   * reconnected behind a publicly reachable URL.
   */
  private async prepareStripeManualConnect(
    secret: ConnectorSecretPayload,
    metadata: Record<string, string>,
  ): Promise<void> {
    const secretKey = stringSecret(secret.secretKey);
    if (!secretKey) throw new Error("invalid_connector_payload:stripe");

    const stripeAccountId = stringSecret(secret.stripeAccountId);
    if (stripeAccountId) metadata.stripeAccountId = stripeAccountId;

    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      };
      if (stripeAccountId) headers["Stripe-Account"] = stripeAccountId;

      const params = new URLSearchParams();
      params.set("url", `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/stripe/webhook`);
      params.append("enabled_events[]", "charge.succeeded");
      params.append("enabled_events[]", "charge.failed");
      params.append("enabled_events[]", "customer.subscription.created");

      const response = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
        method: "POST",
        headers,
        body: params.toString(),
      });
      if (!response.ok) {
        throw new Error(`Couldn't register the Stripe webhook: ${await response.text()}`);
      }
      const json = (await response.json()) as { secret?: string };
      if (!json.secret) throw new Error("Stripe did not return a webhook signing secret");
      secret.webhookSigningSecret = json.secret;
    } catch (error) {
      logger.warn("stripe webhook registration failed; connecting without live triggers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Registers a Razorpay webhook for payment.captured/payment.failed. Unlike
   * every other provider here, Razorpay requires the CALLER to supply the
   * signing secret up front — its API just echoes back whatever `secret` is
   * sent in the request rather than generating and returning one, so we mint
   * a random secret ourselves and store that (not anything read from the
   * response). Non-fatal on failure (e.g. a localhost callback URL in local
   * dev) — same treatment as Calendly/Stripe above.
   */
  private async prepareRazorpayManualConnect(
    secret: ConnectorSecretPayload,
    _metadata: Record<string, string>,
  ): Promise<void> {
    const keyId = stringSecret(secret.keyId);
    const keySecret = stringSecret(secret.keySecret);
    if (!keyId || !keySecret) throw new Error("invalid_connector_payload:razorpay");

    const webhookSecret = randomBytes(24).toString("hex");
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const response = await fetch("https://api.razorpay.com/v1/webhooks", {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/razorpay/webhook`,
          events: ["payment.captured", "payment.failed"],
          secret: webhookSecret,
        }),
      });
      if (!response.ok) {
        throw new Error(`Couldn't register the Razorpay webhook: ${await response.text()}`);
      }
      secret.webhookSigningSecret = webhookSecret;
    } catch (error) {
      logger.warn("razorpay webhook registration failed; connecting without live triggers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Razorpay webhooks carry no caller-side account identifier at all — same
   * try-all tradeoff as Stripe's manual (non-Connect) mode: every connected
   * Razorpay account's stored secret has to be handed to the gateway to try
   * in turn until one produces a valid HMAC.
   */
  async getAllRazorpayWebhookSecrets(): Promise<Array<{ userId: string; secret: string }>> {
    const accounts = await this.repository.findAllByProvider("razorpay");
    const out: Array<{ userId: string; secret: string }> = [];
    for (const account of accounts) {
      const secret = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSigningSecret);
      if (secret) out.push({ userId: account.userId, secret });
    }
    return out;
  }

  /**
   * Registers a PayPal webhook for PAYMENT.CAPTURE.COMPLETED/REFUNDED.
   * PayPal doesn't hand back a signing secret the way every other provider
   * here does — verifying an incoming webhook instead means calling
   * PayPal's own verify-webhook-signature endpoint per event, keyed by the
   * `id` this registration call returns. That id is stored as `webhookId`.
   * Non-fatal on failure (e.g. a localhost callback URL in local dev) —
   * same treatment as Calendly/Stripe/Razorpay above.
   */
  private async preparePayPalManualConnect(
    secret: ConnectorSecretPayload,
    _metadata: Record<string, string>,
  ): Promise<void> {
    const clientId = stringSecret(secret.clientId);
    const clientSecret = stringSecret(secret.clientSecret);
    if (!clientId || !clientSecret) throw new Error("invalid_connector_payload:paypal");

    try {
      const token = await this.getPayPalAccessToken(clientId, clientSecret);
      const response = await fetch("https://api-m.paypal.com/v1/notifications/webhooks", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/paypal/webhook`,
          event_types: [{ name: "PAYMENT.CAPTURE.COMPLETED" }, { name: "PAYMENT.CAPTURE.REFUNDED" }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Couldn't register the PayPal webhook: ${await response.text()}`);
      }
      const json = (await response.json()) as { id?: string };
      if (!json.id) throw new Error("PayPal did not return a webhook id");
      secret.webhookId = json.id;
    } catch (error) {
      logger.warn("paypal webhook registration failed; connecting without live triggers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getPayPalAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`paypal_auth_${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("paypal_auth_no_token");
    return data.access_token;
  }

  /**
   * All connected PayPal accounts' credentials + webhook id, for the
   * gateway's try-each-account verification loop. PayPal gives no local
   * HMAC to check — confirming which account a webhook belongs to means
   * calling PayPal's verify-webhook-signature endpoint once per candidate
   * account, i.e. an outbound PayPal API call (token fetch + verify) per
   * candidate per incoming webhook. That's a real efficiency tradeoff, not
   * an oversight — it's the only resolution strategy PayPal's API leaves
   * available when there's no account-identifying field in the payload.
   */
  async getAllPayPalWebhookAccounts(): Promise<
    Array<{ userId: string; clientId: string; clientSecret: string; webhookId: string }>
  > {
    const accounts = await this.repository.findAllByProvider("paypal");
    const out: Array<{ userId: string; clientId: string; clientSecret: string; webhookId: string }> = [];
    for (const account of accounts) {
      const payload = this.vault.decrypt(account.encryptedPayload);
      const clientId = stringSecret(payload.clientId);
      const clientSecret = stringSecret(payload.clientSecret);
      const webhookId = stringSecret(payload.webhookId);
      if (clientId && clientSecret && webhookId) out.push({ userId: account.userId, clientId, clientSecret, webhookId });
    }
    return out;
  }

  /** Stripe Connect events carry `account` directly — look up that account's stored webhook secret for verification. */
  async getStripeWebhookSecretByAccount(
    stripeAccountId: string,
  ): Promise<{ userId: string; secret: string } | undefined> {
    const accounts = await this.repository.findAllByProviderAndMetadataField("stripe", "stripeAccountId", stripeAccountId);
    for (const account of accounts) {
      const secret = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSigningSecret);
      if (secret) return { userId: account.userId, secret };
    }
    return undefined;
  }

  /**
   * Plain manual Stripe connections carry no account identifier in the
   * webhook payload at all — each connected account registered its own
   * endpoint/secret pair, so the only way to know which one signed an
   * incoming request is to hand every stored secret to the gateway and let
   * it try each until one produces a valid HMAC. Deliberate try-all
   * tradeoff, same as Statuspage/BetterStack's query-param secret match,
   * used only as the fallback when the event carries no `account` field.
   */
  async getAllStripeWebhookSecrets(): Promise<Array<{ userId: string; secret: string }>> {
    const accounts = await this.repository.findAllByProvider("stripe");
    const out: Array<{ userId: string; secret: string }> = [];
    for (const account of accounts) {
      const secret = stringSecret(this.vault.decrypt(account.encryptedPayload).webhookSigningSecret);
      if (secret) out.push({ userId: account.userId, secret });
    }
    return out;
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

  /**
   * Decrypts Jira credentials — either the OAuth shape (accessToken +
   * cloudId) or the manual API-token fallback (siteUrl/email/apiToken).
   * jira.service.ts branches on which fields are present. Returns null if
   * neither shape is fully populated.
   */
  async getJiraSecret(userId: string): Promise<JiraConnectorSecret | null> {
    const account = await this.repository.find(userId, "jira");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);

    const accessToken = stringSecret(payload.accessToken);
    const cloudId = stringSecret(payload.cloudId);
    if (accessToken && cloudId) {
      return {
        accessToken,
        cloudId,
        refreshToken: stringSecret(payload.refreshToken),
        expiresAt: numberSecret(payload.expiresAt),
      };
    }

    const siteUrl = stringSecret(payload.siteUrl);
    const email = stringSecret(payload.email);
    const apiToken = stringSecret(payload.apiToken);
    if (siteUrl && email && apiToken) {
      return { siteUrl, email, apiToken };
    }
    return null;
  }

  /** Decrypts a PagerDuty REST API key + the "From" user email PagerDuty requires on writes. */
  async getPagerDutySecret(userId: string): Promise<{ apiKey: string; fromEmail: string } | null> {
    const account = await this.repository.find(userId, "pagerduty");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = stringSecret(payload.apiKey);
    const fromEmail = stringSecret(payload.fromEmail);
    if (!apiKey || !fromEmail) return null;
    return { apiKey, fromEmail };
  }

  /** Decrypts a Trello API key + token pair. Returns null if not connected. */
  async getTrelloSecret(userId: string): Promise<{ apiKey: string; token: string } | null> {
    const account = await this.repository.find(userId, "trello");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = stringSecret(payload.apiKey);
    const token = stringSecret(payload.token);
    if (!apiKey || !token) return null;
    return { apiKey, token };
  }

  /** Decrypts an Airtable personal access token. Returns null if not connected. */
  async getAirtableSecret(userId: string): Promise<{ apiKey: string } | null> {
    const account = await this.repository.find(userId, "airtable");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const apiKey = stringSecret(payload.apiKey);
    if (!apiKey) return null;
    return { apiKey };
  }

  /** Decrypts Twilio account credentials. Returns null if not connected. */
  async getTwilioSecret(userId: string): Promise<{ accountSid: string; authToken: string; fromNumber: string } | null> {
    const account = await this.repository.find(userId, "twilio");
    if (!account) return null;
    const payload = this.vault.decrypt(account.encryptedPayload);
    const accountSid = stringSecret(payload.accountSid);
    const authToken = stringSecret(payload.authToken);
    const fromNumber = stringSecret(payload.fromNumber);
    if (!accountSid || !authToken || !fromNumber) return null;
    return { accountSid, authToken, fromNumber };
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

    let payload = this.vault.decrypt(account.encryptedPayload);

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
      const expiresAt = numberSecret(payload.expiresAt);
      const refreshToken = stringSecret(payload.refreshToken);
      if (
        account.authType === "oauth" &&
        expiresAt &&
        refreshToken &&
        expiresAt <= Date.now() + 60_000
      ) {
        payload = await this.refreshStripeOAuth(account, refreshToken);
      }
      const secretKey = payload.secretKey;
      if (typeof secretKey !== "string" || !secretKey) {
        throw new Error(`invalid_connector_payload:${provider}`);
      }
      return {
        connected: true,
        provider: "stripe",
        secret: {
          secretKey,
          refreshToken: stringSecret(payload.refreshToken),
          expiresAt: numberSecret(payload.expiresAt),
          stripeAccountId: stringSecret(payload.stripeAccountId),
          livemode: typeof payload.livemode === "boolean" ? payload.livemode : undefined,
        },
      };
    }

    const keyId = payload.keyId;
    const keySecret = payload.keySecret;
    if (typeof keyId !== "string" || !keyId || typeof keySecret !== "string" || !keySecret) {
      throw new Error(`invalid_connector_payload:${provider}`);
    }
    return { connected: true, provider: "razorpay", secret: { keyId, keySecret } };
  }

  async startOAuth(input: StartOAuthInput) {
    const scopes =
      input.scopeProfile === "automation" && input.provider in automationOauthScopesByProvider
        ? automationOauthScopesByProvider[input.provider as GoogleOAuthProvider]!
        : scopesForOAuthProvider(input.provider);
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
    } else if (input.provider === "shopify") {
      const shopDomain = normalizeShopDomain(input.shopDomain);
      if (!shopDomain) {
        return {
          status: "missing_config" as const,
          message: "Enter your Shopify store domain (e.g. mystore.myshopify.com)",
        };
      }
      const missingConfig = missingOAuthConfig(input.provider);
      if (missingConfig) return missingConfig;
      statePayload = { shopDomain };
    } else if (input.provider === "figma") {
      // No "list my teams" endpoint exists on Figma's API, so the team the
      // webhook gets registered against has to come from the user.
      const teamId = normalizeFigmaTeamId(input.teamId);
      if (!teamId) {
        return {
          status: "missing_config" as const,
          message: "Enter your Figma team ID (from the team URL: figma.com/files/team/<id>/...)",
        };
      }
      const missingConfig = missingOAuthConfig(input.provider);
      if (missingConfig) return missingConfig;
      statePayload = { teamId };
    } else if (input.provider === "box") {
      // Box webhooks watch a specific folder, not "the whole account" — the
      // folder id has to come from the user, same idea as Figma's teamId.
      const folderId = normalizeBoxFolderId(input.folderId);
      if (!folderId) {
        return {
          status: "missing_config" as const,
          message: "Enter the Box folder ID to watch (from the folder's URL: app.box.com/folder/<id>)",
        };
      }
      const missingConfig = missingOAuthConfig(input.provider);
      if (missingConfig) return missingConfig;
      statePayload = { folderId };
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

    const url = authorizationUrlForProvider(
      input.provider,
      scopes,
      state,
      calComOAuthClient,
      codeChallenge,
      statePayload?.shopDomain,
    );

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

    if (provider === "stripe") {
      return this.completeStripeOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        scopes,
      });
    }

    if (provider === "shopify") {
      const shopDomain = shopDomainFromEncryptedState(this.vault, storedState.encryptedPayload);
      if (!shopDomain) {
        throw new Error("Shopify OAuth state is missing the shop domain");
      }
      return this.completeShopifyOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        shopDomain,
      });
    }

    if (provider === "dropbox") {
      return this.completeDropboxOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
      });
    }

    if (provider === "figma") {
      const teamId = teamIdFromEncryptedState(this.vault, storedState.encryptedPayload);
      if (!teamId) {
        throw new Error("Figma OAuth state is missing the team id");
      }
      return this.completeFigmaOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        teamId,
      });
    }

    if (provider === "quickbooks") {
      if (!input.realmId) {
        throw new Error("QuickBooks callback is missing the realmId query param");
      }
      return this.completeQuickBooksOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        realmId: input.realmId,
      });
    }

    if (provider === "xero") {
      return this.completeXeroOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
      });
    }

    if (provider === "deel") {
      return this.completeDeelOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
      });
    }

    if (provider === "box") {
      const folderId = boxFolderIdFromEncryptedState(this.vault, storedState.encryptedPayload);
      if (!folderId) {
        throw new Error("Box OAuth state is missing the folder id");
      }
      return this.completeBoxOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
        folderId,
      });
    }

    if (provider === "jira") {
      return this.completeJiraOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
      });
    }

    if (provider === "calendly") {
      return this.completeCalendlyOAuth({
        code: input.code,
        userId,
        returnTo: storedState.returnTo,
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
        ...(profile?.name ? { accountName: profile.name } : {}),
        ...(profile?.picture ? { picture: profile.picture } : {}),
      },
      // Key by the Google account email so connecting a second account adds a
      // separate row instead of overwriting the first (multi-account support).
    }, { externalId: profile?.email });

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

  private async completeStripeOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    scopes: string[];
  }): Promise<CompleteOAuthResult> {
    const tokenJson = await exchangeStripeOAuthToken({
      grantType: "authorization_code",
      code: input.code,
    });
    const secret = stripeOAuthSecretFromToken(tokenJson);
    const accountId = secret.stripeAccountId;

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "stripe",
      authType: "oauth",
      label: accountId ? `Stripe (${accountId})` : providerLabel("stripe"),
      status: "connected",
      encryptedPayload: this.vault.encrypt(secret),
      scopes: input.scopes,
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(secret.refreshToken),
        tokenExpiresAt: secret.expiresAt ?? null,
        ...(accountId ? { stripeAccountId: accountId } : {}),
        ...(typeof secret.livemode === "boolean" ? { livemode: secret.livemode } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeShopifyOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    shopDomain: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
      throw new Error("Shopify OAuth env vars are missing");
    }
    const response = await fetch(`https://${input.shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: env.SHOPIFY_CLIENT_ID,
        client_secret: env.SHOPIFY_CLIENT_SECRET,
        code: input.code,
      }),
    });
    if (!response.ok) {
      throw new Error(`Shopify token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as { access_token?: string; scope?: string };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Shopify token exchange did not return an access token");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "shopify",
      authType: "oauth",
      label: `Shopify (${input.shopDomain})`,
      status: "connected",
      encryptedPayload: this.vault.encrypt({ shopDomain: input.shopDomain, accessToken }),
      scopes: splitScopes(tokenJson.scope?.replace(/,/g, " ")) ?? [],
      metadata: { setup: "oauth", shopDomain: input.shopDomain },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeDropboxOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.DROPBOX_CLIENT_ID || !env.DROPBOX_CLIENT_SECRET) {
      throw new Error("Dropbox OAuth env vars are missing");
    }
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        grant_type: "authorization_code",
        client_id: env.DROPBOX_CLIENT_ID,
        client_secret: env.DROPBOX_CLIENT_SECRET,
        redirect_uri: env.DROPBOX_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Dropbox token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      account_id?: string;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    const accountId = stringSecret(tokenJson.account_id);
    if (!accessToken || !accountId) {
      throw new Error("Dropbox token exchange did not return an access token and account id");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "dropbox",
      authType: "oauth",
      label: providerLabel("dropbox"),
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        accountId,
      }),
      scopes: [],
      metadata: { setup: "oauth", accountId },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeFigmaOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    teamId: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.FIGMA_CLIENT_ID || !env.FIGMA_CLIENT_SECRET) {
      throw new Error("Figma OAuth env vars are missing");
    }
    const response = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.FIGMA_CLIENT_ID,
        client_secret: env.FIGMA_CLIENT_SECRET,
        redirect_uri: env.FIGMA_REDIRECT_URI,
        code: input.code,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      throw new Error(`Figma token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: string;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Figma token exchange did not return an access token");
    }

    const webhookResult = await this.registerFigmaWebhook(accessToken, input.teamId);

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "figma",
      authType: "oauth",
      label: `Figma (team ${input.teamId})`,
      status: webhookResult.status,
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        teamId: input.teamId,
        webhookPasscode: webhookResult.webhookPasscode ?? null,
        webhookId: webhookResult.webhookId ?? null,
      }),
      scopes: [],
      metadata: {
        setup: "oauth",
        teamId: input.teamId,
        ...(webhookResult.statusMessage ? { statusMessage: webhookResult.statusMessage } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  /**
   * Registers a Figma "FILE_COMMENT" webhook for the given team right after
   * OAuth completes — see FigmaWebhookAuthService for the receiver side.
   * Figma has no free-tier webhooks: teams below Organization/Enterprise get
   * a 403 here, which we treat as a known, user-actionable state rather than
   * a hard failure (the OAuth connection itself is fine, just not wired to
   * fire triggers yet).
   */
  private async registerFigmaWebhook(
    accessToken: string,
    teamId: string,
  ): Promise<{
    status: ConnectorStatus;
    webhookPasscode?: string;
    webhookId?: string;
    statusMessage?: string;
  }> {
    const webhookPasscode = randomBytes(24).toString("hex");
    let response: Response;
    try {
      response = await fetch("https://api.figma.com/v2/webhooks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          event_type: "FILE_COMMENT",
          team_id: teamId,
          endpoint: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/figma/webhook`,
          passcode: webhookPasscode,
        }),
      });
    } catch (error) {
      logger.warn("figma webhook registration request failed", { teamId, error: safeConnectionError(error) });
      return {
        status: "error",
        statusMessage: "Couldn't reach Figma to register the comment webhook. Try reconnecting Figma.",
      };
    }

    if (response.ok) {
      const json = (await response.json().catch(() => ({}))) as { id?: string };
      return { status: "connected", webhookPasscode, webhookId: json.id };
    }

    const bodyText = await response.text().catch(() => "");
    if (response.status === 403) {
      logger.warn("figma webhook registration rejected — likely a non-Organization/Enterprise plan", {
        teamId,
        status: response.status,
        body: bodyText,
      });
      return {
        status: "missing_config",
        statusMessage:
          "Figma webhooks require an Organization or Enterprise plan on your team — comment-triggered automations won't fire until you upgrade or use a different team.",
      };
    }

    logger.warn("figma webhook registration failed", { teamId, status: response.status, body: bodyText });
    return {
      status: "error",
      statusMessage: `Couldn't register the Figma webhook (${response.status}). Comment-triggered automations won't fire until this is fixed — try reconnecting Figma.`,
    };
  }

  /**
   * QuickBooks token exchange uses HTTP Basic auth (client_id:client_secret),
   * same as Notion. The webhook subscription itself is app-level, configured
   * once in the Intuit Developer dashboard against
   * INTUIT_WEBHOOK_VERIFIER_TOKEN — not something we register per-connection.
   */
  private async completeQuickBooksOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    realmId: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.QUICKBOOKS_CLIENT_ID || !env.QUICKBOOKS_CLIENT_SECRET) {
      throw new Error("QuickBooks OAuth env vars are missing");
    }
    const credentials = Buffer.from(`${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
    const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: env.QUICKBOOKS_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`QuickBooks token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    const refreshToken = stringSecret(tokenJson.refresh_token);
    if (!accessToken || !refreshToken) {
      throw new Error("QuickBooks token exchange did not return access and refresh tokens");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "quickbooks",
      authType: "oauth",
      label: `QuickBooks (company ${input.realmId})`,
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken,
        realmId: input.realmId,
        expiresAt: Date.now() + (numberSecret(tokenJson.expires_in) ?? 3600) * 1000,
      }),
      scopes: ["com.intuit.quickbooks.accounting"],
      metadata: { setup: "oauth", realmId: input.realmId },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  /**
   * Xero's tenantId isn't part of the token response — it's fetched right
   * after via GET /connections, which lists every org the user just
   * authorized (we take the first; multi-org selection isn't supported yet).
   */
  private async completeXeroOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.XERO_CLIENT_ID || !env.XERO_CLIENT_SECRET) {
      throw new Error("Xero OAuth env vars are missing");
    }
    const credentials = Buffer.from(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`).toString("base64");
    const response = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: env.XERO_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Xero token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    const refreshToken = stringSecret(tokenJson.refresh_token);
    if (!accessToken || !refreshToken) {
      throw new Error("Xero token exchange did not return access and refresh tokens");
    }

    const connectionsResponse = await fetch("https://api.xero.com/connections", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!connectionsResponse.ok) {
      throw new Error(`Xero /connections lookup failed: ${await connectionsResponse.text()}`);
    }
    const connections = (await connectionsResponse.json()) as Array<{ tenantId?: string; tenantName?: string }>;
    const tenantId = stringSecret(connections[0]?.tenantId);
    if (!tenantId) {
      throw new Error("Xero did not return a connected tenant");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "xero",
      authType: "oauth",
      label: connections[0]?.tenantName ? `Xero (${connections[0].tenantName})` : "Xero",
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken,
        tenantId,
        expiresAt: Date.now() + (numberSecret(tokenJson.expires_in) ?? 1800) * 1000,
      }),
      scopes: [],
      metadata: { setup: "oauth", tenantId },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  /**
   * Deel's OAuth authorize/token URLs and webhook signature scheme are now
   * confirmed against developer.deel.com: token exchange stays on
   * app.deel.com, but every data-API call (organizations, webhooks) lives on
   * a separate host, api.letsdeel.com, and 401s without x-client-id
   * alongside the bearer token — easy to miss since the OAuth endpoints
   * don't need it.
   */
  private async completeDeelOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.DEEL_CLIENT_ID || !env.DEEL_CLIENT_SECRET) {
      throw new Error("Deel OAuth env vars are missing");
    }
    const response = await fetch("https://app.deel.com/oauth2/tokens", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: env.DEEL_CLIENT_ID,
        client_secret: env.DEEL_CLIENT_SECRET,
        redirect_uri: env.DEEL_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Deel token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Deel token exchange did not return an access token");
    }

    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "x-client-id": env.DEEL_CLIENT_ID,
    };

    const orgRes = await fetch("https://api.letsdeel.com/rest/organizations", { headers: authHeaders });
    if (!orgRes.ok) {
      throw new Error(`Deel organization lookup failed: ${await orgRes.text()}`);
    }
    const orgJson = (await orgRes.json()) as { data?: Array<{ id?: string }> };
    const organizationId = orgJson.data?.[0]?.id;
    if (!organizationId) {
      throw new Error("Deel did not return an organization id");
    }

    const webhookRes = await fetch("https://api.letsdeel.com/rest/webhooks", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        url: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/deel/webhook`,
        events: ["contract.created", "payment.completed"],
        description: "Rizly automation triggers",
      }),
    });
    if (!webhookRes.ok) {
      throw new Error(`Couldn't register the Deel webhook: ${await webhookRes.text()}`);
    }
    const webhookJson = (await webhookRes.json()) as { signing_key?: string };
    const webhookSigningSecret = webhookJson.signing_key;
    if (!webhookSigningSecret) {
      throw new Error("Deel did not return a webhook signing key");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "deel",
      authType: "oauth",
      label: providerLabel("deel"),
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresAt: tokenExpiresAt(numberSecret(tokenJson.expires_in)) ?? null,
        organizationId,
        webhookSigningSecret,
      }),
      scopes: [],
      metadata: { setup: "oauth", organizationId },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeJiraOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.JIRA_CLIENT_ID || !env.JIRA_CLIENT_SECRET) {
      throw new Error("Jira OAuth env vars are missing");
    }
    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: env.JIRA_CLIENT_ID,
        client_secret: env.JIRA_CLIENT_SECRET,
        code: input.code,
        redirect_uri: env.JIRA_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Jira token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Jira token exchange did not return an access token");
    }

    // Atlassian OAuth apps never see a Jira site's URL directly — every API
    // call is scoped by cloudId instead, resolved from the token's
    // accessible resources. Pick the first accessible Jira site.
    const resourcesResponse = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (!resourcesResponse.ok) {
      throw new Error(`Jira accessible-resources lookup failed: ${await resourcesResponse.text()}`);
    }
    const resources = (await resourcesResponse.json()) as Array<{ id?: string; name?: string; url?: string }>;
    const site = resources[0];
    const cloudId = stringSecret(site?.id);
    if (!cloudId) {
      throw new Error("No accessible Jira site was found for this account");
    }

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "jira",
      authType: "oauth",
      label: site?.name ? `Jira (${site.name})` : providerLabel("jira"),
      status: "connected",
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresAt: tokenExpiresAt(numberSecret(tokenJson.expires_in)) ?? null,
        cloudId,
      }),
      scopes: scopesForOAuthProvider("jira"),
      metadata: {
        setup: "oauth",
        hasRefreshToken: Boolean(tokenJson.refresh_token),
        ...(site?.name ? { accountName: site.name } : {}),
        ...(site?.url ? { siteUrl: site.url } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  private async completeBoxOAuth(input: {
    code: string;
    userId: string;
    returnTo?: string;
    folderId: string;
  }): Promise<CompleteOAuthResult> {
    if (!env.BOX_CLIENT_ID || !env.BOX_CLIENT_SECRET) {
      throw new Error("Box OAuth env vars are missing");
    }
    const response = await fetch("https://api.box.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: env.BOX_CLIENT_ID,
        client_secret: env.BOX_CLIENT_SECRET,
        redirect_uri: env.BOX_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      throw new Error(`Box token exchange failed: ${await response.text()}`);
    }
    const tokenJson = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = stringSecret(tokenJson.access_token);
    if (!accessToken) {
      throw new Error("Box token exchange did not return an access token");
    }

    const webhookResult = await this.registerBoxWebhook(accessToken, input.folderId);

    const account = await this.repository.upsert({
      userId: input.userId,
      provider: "box",
      authType: "oauth",
      label: `Box (folder ${input.folderId})`,
      status: webhookResult.status,
      encryptedPayload: this.vault.encrypt({
        accessToken,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresAt: tokenExpiresAt(numberSecret(tokenJson.expires_in)) ?? null,
        folderId: input.folderId,
        primarySignatureKey: webhookResult.primarySignatureKey ?? null,
        secondarySignatureKey: webhookResult.secondarySignatureKey ?? null,
        webhookId: webhookResult.webhookId ?? null,
      }),
      scopes: [],
      metadata: {
        setup: "oauth",
        folderId: input.folderId,
        ...(webhookResult.statusMessage ? { statusMessage: webhookResult.statusMessage } : {}),
      },
    });

    return { ...this.toSummary(account), returnTo: input.returnTo };
  }

  /**
   * Registers a Box webhook (FILE.UPLOADED, FILE.TRASHED) for the given
   * folder right after OAuth completes — see BoxWebhookAuthService for the
   * receiver side. Box returns both a primary and secondary signature key;
   * verification must accept either (Box's documented key-rotation design).
   */
  private async registerBoxWebhook(
    accessToken: string,
    folderId: string,
  ): Promise<{
    status: ConnectorStatus;
    primarySignatureKey?: string;
    secondarySignatureKey?: string;
    webhookId?: string;
    statusMessage?: string;
  }> {
    let response: Response;
    try {
      response = await fetch("https://api.box.com/2.0/webhooks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: { id: folderId, type: "folder" },
          address: `${env.NEXT_PUBLIC_GATEWAY_URL}/api/connectors/box/webhook`,
          triggers: ["FILE.UPLOADED", "FILE.TRASHED"],
        }),
      });
    } catch (error) {
      logger.warn("box webhook registration request failed", { folderId, error: safeConnectionError(error) });
      return {
        status: "error",
        statusMessage: "Couldn't reach Box to register the folder webhook. Try reconnecting Box.",
      };
    }

    if (response.ok) {
      const json = (await response.json().catch(() => ({}))) as {
        id?: string;
        signature_key?: string;
      };
      // Box's create-webhook response only ever returns one signature key
      // per call — the secondary is only visible/rotatable from the console.
      return { status: "connected", webhookId: json.id, primarySignatureKey: json.signature_key };
    }

    const bodyText = await response.text().catch(() => "");
    logger.warn("box webhook registration failed", { folderId, status: response.status, body: bodyText });
    return {
      status: "error",
      statusMessage: `Couldn't register the Box webhook (${response.status}). File-triggered automations won't fire until this is fixed — try reconnecting Box.`,
    };
  }

  private async refreshStripeOAuth(
    account: ConnectedAccount,
    refreshToken: string,
  ): Promise<StripeConnectorSecret> {
    const tokenJson = await exchangeStripeOAuthToken({
      grantType: "refresh_token",
      refreshToken,
    });
    const secret = stripeOAuthSecretFromToken(tokenJson);
    await this.repository.updateById(account.id, {
      encryptedPayload: this.vault.encrypt(secret),
      metadata: {
        ...account.metadata,
        hasRefreshToken: Boolean(secret.refreshToken),
        tokenExpiresAt: secret.expiresAt ?? null,
        ...(secret.stripeAccountId ? { stripeAccountId: secret.stripeAccountId } : {}),
        ...(typeof secret.livemode === "boolean" ? { livemode: secret.livemode } : {}),
      },
    });
    return secret;
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
  return (
    value === "gmail" ||
    value === "calendar" ||
    value === "calcom" ||
    value === "notion" ||
    value === "github" ||
    value === "stripe" ||
    value === "shopify" ||
    value === "dropbox" ||
    value === "figma" ||
    value === "quickbooks" ||
    value === "xero" ||
    value === "deel" ||
    value === "box" ||
    value === "jira" ||
    value === "calendly"
  );
}

function scopesForOAuthProvider(provider: ConnectorOAuthProvider): string[] {
  if (provider === "notion") return [];
  if (provider === "stripe") return STRIPE_APP_PERMISSIONS;
  // "repo" is required to see private-repo issues/PRs; classic OAuth apps
  // have no read-only variant of it. The GitHubService still only GETs.
  if (provider === "github") return ["repo", "read:user"];
  if (provider === "shopify") return (env.SHOPIFY_SCOPES ?? "read_orders,read_inventory").split(",").map((s) => s.trim());
  if (provider === "dropbox") return ["files.metadata.read", "files.content.read"];
  if (provider === "figma") return ["file_comments:read", "webhooks:write"];
  if (provider === "quickbooks") return ["com.intuit.quickbooks.accounting"];
  if (provider === "xero") return ["openid", "profile", "accounting.transactions.read", "offline_access"];
  // Deel's docs confirm the {resource}:read/write pattern generally (e.g.
  // "contracts:read", "timesheets:write") but don't enumerate every valid
  // resource name — "payments:read" specifically is inferred from that
  // pattern, not quoted directly in the docs. Adjust if Deel rejects it.
  if (provider === "deel") return ["contracts:read", "payments:read"];
  if (provider === "box") return ["root_readwrite"];
  // offline_access is required for a refresh token; write:jira-work keeps the
  // existing createIssue() action working once a user is on OAuth instead of
  // the manual API-token path.
  if (provider === "jira") return ["read:jira-work", "read:jira-user", "write:jira-work", "offline_access"];
  if (provider === "calendly") {
    return [
      "scheduled_events:read",
      "event_types:read",
      "availability:read",
      "users:read",
      "webhooks:read",
      "webhooks:write",
    ];
  }
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

  if (provider === "stripe" && (!env.STRIPE_APP_CLIENT_ID || !env.STRIPE_APP_SECRET_KEY)) {
    return {
      status: "missing_config" as const,
      message: "STRIPE_APP_CLIENT_ID and STRIPE_APP_SECRET_KEY are missing",
    };
  }

  if (provider === "shopify" && (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are missing",
    };
  }

  if (provider === "dropbox" && (!env.DROPBOX_CLIENT_ID || !env.DROPBOX_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET are missing",
    };
  }

  if (provider === "figma" && (!env.FIGMA_CLIENT_ID || !env.FIGMA_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET are missing",
    };
  }

  if (provider === "quickbooks" && (!env.QUICKBOOKS_CLIENT_ID || !env.QUICKBOOKS_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET are missing",
    };
  }

  if (provider === "xero" && (!env.XERO_CLIENT_ID || !env.XERO_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "XERO_CLIENT_ID and XERO_CLIENT_SECRET are missing",
    };
  }

  if (provider === "deel" && (!env.DEEL_CLIENT_ID || !env.DEEL_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "DEEL_CLIENT_ID and DEEL_CLIENT_SECRET are missing",
    };
  }

  if (provider === "box" && (!env.BOX_CLIENT_ID || !env.BOX_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "BOX_CLIENT_ID and BOX_CLIENT_SECRET are missing",
    };
  }

  if (provider === "jira" && (!env.JIRA_CLIENT_ID || !env.JIRA_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "JIRA_CLIENT_ID and JIRA_CLIENT_SECRET are missing",
    };
  }

  if (provider === "calendly" && (!env.CALENDLY_CLIENT_ID || !env.CALENDLY_CLIENT_SECRET)) {
    return {
      status: "missing_config" as const,
      message: "CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET are missing",
    };
  }

  if (
    (provider === "gmail" || provider === "calendar" || provider === "google_workspace") &&
    !env.GOOGLE_CLIENT_ID
  ) {
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
  shopDomain?: string,
): string {
  if (provider === "shopify") {
    const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    url.searchParams.set("client_id", env.SHOPIFY_CLIENT_ID ?? "");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("redirect_uri", env.SHOPIFY_REDIRECT_URI);
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "dropbox") {
    const url = new URL("https://www.dropbox.com/oauth2/authorize");
    url.searchParams.set("client_id", env.DROPBOX_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.DROPBOX_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    // Needed to get a refresh_token back — Dropbox short-lived access tokens
    // otherwise expire with no way to renew them silently.
    url.searchParams.set("token_access_type", "offline");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "figma") {
    const url = new URL("https://www.figma.com/oauth");
    url.searchParams.set("client_id", env.FIGMA_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.FIGMA_REDIRECT_URI);
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  if (provider === "quickbooks") {
    const url = new URL("https://appcenter.intuit.com/connect/oauth2");
    url.searchParams.set("client_id", env.QUICKBOOKS_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.QUICKBOOKS_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "xero") {
    const url = new URL("https://login.xero.com/identity/connect/authorize");
    url.searchParams.set("client_id", env.XERO_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.XERO_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "deel") {
    // verify against current docs: authorize host/path unconfirmed.
    const url = new URL("https://app.deel.com/oauth2/authorize");
    url.searchParams.set("client_id", env.DEEL_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.DEEL_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "box") {
    const url = new URL("https://account.box.com/api/oauth2/authorize");
    url.searchParams.set("client_id", env.BOX_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.BOX_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "jira") {
    const url = new URL("https://auth.atlassian.com/authorize");
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("client_id", env.JIRA_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.JIRA_REDIRECT_URI);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    // Atlassian silently reuses a prior consent otherwise, which can grant
    // fewer scopes than requested if the user connected before with less access.
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  if (provider === "calendly") {
    const url = new URL("https://auth.calendly.com/oauth/authorize");
    url.searchParams.set("client_id", env.CALENDLY_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.CALENDLY_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "stripe") {
    const url = new URL(env.STRIPE_APP_AUTHORIZE_URL);
    url.searchParams.set("client_id", env.STRIPE_APP_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", env.STRIPE_APP_REDIRECT_URI);
    url.searchParams.set("state", state);
    return url.toString();
  }

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
  // Incremental auth: the issued token carries the union of these scopes and any
  // the user previously granted, so a reduced (e.g. automation read-only) request
  // never strips scopes the assistant already relies on.
  url.searchParams.set("include_granted_scopes", "true");
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

/** Accepts "mystore" or "mystore.myshopify.com" and normalizes to the latter; rejects anything else to keep the OAuth authorize URL host from being attacker-controlled. */
function normalizeShopDomain(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : undefined;
}

function shopDomainFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): string | undefined {
  if (!encryptedPayload) return undefined;
  try {
    return stringSecret(vault.decrypt(encryptedPayload).shopDomain);
  } catch {
    return undefined;
  }
}

/** Figma team ids are numeric strings (e.g. from figma.com/files/team/123456/...). */
function normalizeFigmaTeamId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[0-9]+$/.test(trimmed) ? trimmed : undefined;
}

function teamIdFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): string | undefined {
  if (!encryptedPayload) return undefined;
  try {
    return stringSecret(vault.decrypt(encryptedPayload).teamId);
  } catch {
    return undefined;
  }
}

/** Box folder ids are numeric strings (e.g. from app.box.com/folder/123456). */
function normalizeBoxFolderId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[0-9]+$/.test(trimmed) ? trimmed : undefined;
}

function boxFolderIdFromEncryptedState(
  vault: ConnectorVaultService,
  encryptedPayload: string | undefined,
): string | undefined {
  if (!encryptedPayload) return undefined;
  try {
    return stringSecret(vault.decrypt(encryptedPayload).folderId);
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

async function fetchGoogleProfile(
  accessToken: string,
): Promise<{ email?: string; name?: string; picture?: string } | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { email?: string; name?: string; picture?: string };
  return payload ?? null;
}

type StripeOAuthTokenJson = Record<string, string | number | boolean | null>;

async function exchangeStripeOAuthToken(
  input:
    | { grantType: "authorization_code"; code: string }
    | { grantType: "refresh_token"; refreshToken: string },
): Promise<StripeOAuthTokenJson> {
  if (!env.STRIPE_APP_SECRET_KEY) {
    throw new Error("STRIPE_APP_SECRET_KEY is missing");
  }

  const body = new URLSearchParams({ grant_type: input.grantType });
  if (input.grantType === "authorization_code") body.set("code", input.code);
  else body.set("refresh_token", input.refreshToken);

  const credentials = Buffer.from(`${env.STRIPE_APP_SECRET_KEY}:`).toString("base64");
  const response = await fetch("https://api.stripe.com/v1/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe OAuth token exchange failed: ${errorText}`);
  }
  return (await response.json()) as StripeOAuthTokenJson;
}

function stripeOAuthSecretFromToken(tokenJson: StripeOAuthTokenJson): StripeConnectorSecret {
  const accessToken = stringSecret(tokenJson.access_token);
  const refreshToken = stringSecret(tokenJson.refresh_token);
  const stripeAccountId =
    stringSecret(tokenJson.stripe_user_id) ?? stringSecret(tokenJson.account_id);
  if (!accessToken || !refreshToken) {
    throw new Error("Stripe OAuth token exchange did not return access and refresh tokens");
  }
  const expiresIn = numberSecret(tokenJson.expires_in) ?? 3600;
  return {
    secretKey: accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    ...(stripeAccountId ? { stripeAccountId } : {}),
    ...(typeof tokenJson.livemode === "boolean" ? { livemode: tokenJson.livemode } : {}),
  };
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

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
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
    slack_surface: "Slack DM",
    notion: "Notion",
    custom_api: "Custom API",
    telegram: "Telegram",
    paypal: "PayPal",
    github: "GitHub",
    mpesa: "M-Pesa",
    discord: "Discord",
    google_workspace: "Google Drive + Sheets + Docs",
    jira: "Jira",
    pagerduty: "PagerDuty",
    trello: "Trello",
    airtable: "Airtable",
    twilio: "Twilio",
    shopify: "Shopify",
    calendly: "Calendly",
    typeform: "Typeform",
    gumroad: "Gumroad",
    lemonsqueezy: "Lemon Squeezy",
    dropbox: "Dropbox",
    figma: "Figma",
    uptimerobot: "UptimeRobot",
    quickbooks: "QuickBooks",
    xero: "Xero",
    wise: "Wise",
    bamboohr: "BambooHR",
    deel: "Deel",
    box: "Box",
    statuspage: "Statuspage",
    betterstack: "Better Stack",
  };

  return labels[provider];
}
