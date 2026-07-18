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
  | "paypal"
  | "github"
  | "mpesa"
  | "discord";

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

export type GoogleOAuthProvider = "gmail" | "calendar";
export type ConnectorOAuthProvider = GoogleOAuthProvider | "calcom" | "notion";

export type StartOAuthInput = {
  userId?: string;
  provider: ConnectorOAuthProvider;
  returnTo?: string;
  calComClientId?: string;
  calComClientSecret?: string;
  /** Which Cal.com OAuth client to use - they're separate approved apps per
   * data-residency org, not a single client that works everywhere. */
  calComRegion?: "global" | "eu";
};

export type CompleteOAuthInput = {
  userId?: string;
  code: string;
  state?: string;
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
export type StripeConnectorSecret = { secretKey: string };
export type CalComConnectorSecret = { apiKey: string };
export type PayPalConnectorSecret = { clientId: string; clientSecret: string };
export type GitHubConnectorSecret = { token: string };
export type SlackConnectorSecret = { botToken: string };
export type NotionConnectorSecret = { apiToken: string };
export type DiscordConnectorSecret = { webhookUrl: string };
export type MpesaConnectorSecret = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  environment: "sandbox" | "production";
};

export type DataSourceSecretResult =
  | { connected: false }
  | { connected: true; provider: "postgres"; secret: PostgresConnectorSecret }
  | { connected: true; provider: "mongodb"; secret: MongoConnectorSecret }
  | { connected: true; provider: "razorpay"; secret: RazorpayConnectorSecret }
  | { connected: true; provider: "stripe"; secret: StripeConnectorSecret };
