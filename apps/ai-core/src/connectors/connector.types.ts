export type ConnectorProvider =
  | "google"
  | "gmail"
  | "calendar"
  | "calcom"
  | "razorpay"
  | "stripe"
  | "postgres"
  | "mongodb"
  | "slack"
  | "notion"
  | "custom_api"
  | "telegram"
  // The Slack chat *surface* (DM with the Rizly bot) — kept distinct from
  // "slack", the per-user workspace read connector, so linking the surface
  // can never clobber that token (both upsert by userId+provider).
  | "slack_surface"
  | "paypal"
  | "github"
  | "mpesa"
  | "discord"
  // Bundled Drive/Sheets/Docs connection for the automation flow-builder's
  // Google Workspace actions — a third independent Google OAuth grant, same
  // pattern as the gmail/calendar split (see GoogleService.findAccount).
  | "google_workspace"
  // Manual API-key/token connectors — no OAuth app registration needed.
  | "jira"
  | "pagerduty"
  | "trello"
  | "airtable"
  | "twilio"
  // Push/webhook-only connectors — see apps/gateway's <provider>-webhook-*.ts
  // receivers and AiCoreService.<provider>WebhookEvent.
  | "shopify"
  | "calendly"
  | "typeform"
  | "gumroad"
  | "lemonsqueezy"
  | "dropbox"
  | "figma"
  | "uptimerobot"
  | "quickbooks"
  | "xero"
  | "wise"
  | "bamboohr"
  | "deel"
  | "box"
  | "statuspage"
  | "betterstack";

export type ConnectorAuthType = "oauth" | "manual";

export type ConnectorStatus = "connected" | "missing_config" | "error";

export type ConnectorSecretValue =
  | string
  | number
  | boolean
  | null
  | ConnectorSecretValue[]
  | { [key: string]: ConnectorSecretValue };

export type ConnectorSecretPayload = Record<string, ConnectorSecretValue>;

export type ConnectedAccount = {
  id: string;
  userId: string;
  provider: ConnectorProvider;
  authType: ConnectorAuthType;
  label: string;
  status: ConnectorStatus;
  encryptedPayload: string;
  scopes: string[];
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorSummary = {
  id: string;
  userId: string;
  provider: ConnectorProvider;
  authType: ConnectorAuthType;
  label: string;
  status: ConnectorStatus;
  scopes: string[];
  metadata: ConnectedAccount["metadata"];
  createdAt: string;
  updatedAt: string;
};

export type SaveConnectorInput = {
  userId?: string;
  provider: ConnectorProvider;
  authType?: ConnectorAuthType;
  label?: string;
  accountId?: string;
  secret: ConnectorSecretPayload;
  scopes?: string[];
  metadata?: ConnectedAccount["metadata"];
};

export type DeleteConnectorInput = {
  userId?: string;
  provider: ConnectorProvider;
};

export type GoogleOAuthProvider = "gmail" | "calendar" | "google_workspace";
export type ConnectorOAuthProvider =
  | GoogleOAuthProvider
  | "calcom"
  | "notion"
  | "github"
  | "stripe"
  | "shopify"
  | "dropbox"
  | "figma"
  | "quickbooks"
  | "xero"
  | "deel"
  | "box"
  | "jira"
  | "calendly";

export type StartOAuthInput = {
  userId?: string;
  provider: ConnectorOAuthProvider;
  returnTo?: string;
  /** "automation" requests only the scopes an automation step needs (e.g. Gmail
   * read-only, no send/contacts). Defaults to the full assistant scope set. */
  scopeProfile?: "full" | "automation";
  calComClientId?: string;
  calComClientSecret?: string;
  /** Which Cal.com OAuth client to use - they're separate approved apps per
   * data-residency org, not a single client that works everywhere. */
  calComRegion?: "global" | "eu";
  /** Shopify's authorize URL is per-store; required only when provider === "shopify". */
  shopDomain?: string;
  /** Figma has no "list my teams" API — the team to register a webhook for
   * has to come from the user; required only when provider === "figma". */
  teamId?: string;
  /** Box has no "watch my whole account" webhook — the folder to register a
   * webhook against has to come from the user; required only when provider === "box". */
  folderId?: string;
};

export type CompleteOAuthInput = {
  userId?: string;
  code: string;
  state?: string;
  /** Intuit returns this as a separate callback query param (not embeddable
   * in `state`, which we control) identifying which QuickBooks company authorized. */
  realmId?: string;
};

export type StartCalComOAuthInput = {
  userId?: string;
  returnTo?: string;
};

export type CompleteCalComOAuthInput = {
  userId?: string;
  code: string;
  state?: string;
};

/** Decrypted Cal.com OAuth token payload. expiresAt is epoch ms. */
export type CalComOAuthSecret = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId?: string;
  clientSecret?: string;
  /** Which Cal.com org's OAuth endpoints this token was issued by - global
   * and cal.eu are separate instances, so a refresh must hit the same one. */
  region?: "global" | "eu";
};

export type CompleteOAuthResult = ConnectorSummary & { returnTo?: string };

// --- Ad-hoc business data sources (business_snapshot) -----------------------

export type DataSourceProvider = "postgres" | "mongodb" | "razorpay" | "stripe";

export type PostgresConnectorSecret = { connectionUrl: string };
export type MongoConnectorSecret = { connectionUrl: string };
export type RazorpayConnectorSecret = { keyId: string; keySecret: string };
export type StripeConnectorSecret = {
  /** Manual secret key or the current Stripe Apps OAuth access token. */
  secretKey: string;
  refreshToken?: string;
  expiresAt?: number;
  stripeAccountId?: string;
  livemode?: boolean;
};
export type CalComConnectorSecret = { apiKey: string };
export type PayPalConnectorSecret = { clientId: string; clientSecret: string };
export type GitHubConnectorSecret = { token: string };
export type SlackConnectorSecret = { botToken: string };
export type NotionConnectorSecret = { apiToken: string };
export type DiscordConnectorSecret = {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  guildId?: string;
};
export type MpesaConnectorSecret = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  environment: "sandbox" | "production";
};
/**
 * Manual (siteUrl/email/apiToken, Basic auth) and OAuth (accessToken/cloudId,
 * Bearer auth) are mutually exclusive shapes — jira.service.ts branches on
 * which fields are present. cloudId is required for every OAuth API call
 * (fetched once via the accessible-resources endpoint at connect time).
 */
export type JiraConnectorSecret = {
  siteUrl?: string;
  email?: string;
  apiToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  cloudId?: string;
};
export type PagerDutyConnectorSecret = { apiKey: string; fromEmail: string };
export type TrelloConnectorSecret = { apiKey: string; token: string };
export type AirtableConnectorSecret = { apiKey: string };
export type TwilioConnectorSecret = { accountSid: string; authToken: string; fromNumber: string };
export type ShopifyConnectorSecret = { shopDomain: string; accessToken: string };
/** apiToken is the Calendly Personal Access Token; userUri/organizationUri and
 * webhookSigningKey are captured at connect-time (see ConnectorService.connectCalendly). */
export type CalendlyConnectorSecret = {
  apiToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userUri?: string;
  organizationUri?: string;
  webhookSigningKey?: string;
  webhookSubscriptionUri?: string;
};
export type TypeformConnectorSecret = { apiToken: string; formId?: string; webhookSecret?: string };
export type GumroadConnectorSecret = { accessToken: string; sellerId?: string };
export type LemonSqueezyConnectorSecret = { apiKey: string; storeId?: string; webhookSecret?: string };
export type DropboxConnectorSecret = { accessToken: string; refreshToken?: string; accountId: string };
export type FigmaConnectorSecret = {
  accessToken: string;
  refreshToken?: string;
  teamId?: string;
  webhookPasscode?: string;
  /** Figma's webhook id, needed to DELETE it on disconnect. */
  webhookId?: string;
};
export type UptimeRobotConnectorSecret = { apiKey: string; webhookSecret: string };
export type QuickBooksConnectorSecret = {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: number;
};
export type XeroConnectorSecret = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  expiresAt: number;
};
export type WiseConnectorSecret = {
  apiToken: string;
  profileId: string;
  /** Returned by POST /v3/profiles/{profileId}/webhooks/subscriptions, needed to delete it on disconnect. */
  webhookSubscriptionId?: string;
};
export type BambooHrConnectorSecret = { subdomain: string; apiKey: string };
export type DeelConnectorSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Per-webhook signing secret Deel returns at subscription creation. */
  webhookSigningSecret?: string;
  /** Deel organization id (GET /rest/organizations) — webhook payloads carry this in meta.organization_id, so it's how an incoming event resolves back to the right connected account. */
  organizationId?: string;
};
export type BoxConnectorSecret = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  folderId: string;
  /** Box's key-rotation design: verification must accept either signing key. */
  primarySignatureKey?: string;
  secondarySignatureKey?: string;
  webhookId?: string;
};
export type StatuspageConnectorSecret = { pageId: string; apiKey?: string; webhookSecret: string };
export type BetterStackConnectorSecret = { apiKey: string; webhookSecret: string };

export type DataSourceSecretResult =
  | { connected: false }
  | { connected: true; provider: "postgres"; secret: PostgresConnectorSecret }
  | { connected: true; provider: "mongodb"; secret: MongoConnectorSecret }
  | { connected: true; provider: "razorpay"; secret: RazorpayConnectorSecret }
  | { connected: true; provider: "stripe"; secret: StripeConnectorSecret };
