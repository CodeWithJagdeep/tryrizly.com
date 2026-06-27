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
  | "telegram";

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

export type StartOAuthInput = {
  userId?: string;
  provider: GoogleOAuthProvider;
  returnTo?: string;
};

export type CompleteOAuthInput = {
  userId?: string;
  code: string;
  state?: string;
};

export type CompleteOAuthResult = ConnectorSummary & { returnTo?: string };

// --- Ad-hoc business data sources (business_snapshot) -----------------------

export type DataSourceProvider = "postgres" | "mongodb" | "razorpay" | "stripe";

export type PostgresConnectorSecret = { connectionUrl: string };
export type MongoConnectorSecret = { connectionUrl: string };
export type RazorpayConnectorSecret = { keyId: string; keySecret: string };
export type StripeConnectorSecret = { secretKey: string };
export type CalComConnectorSecret = { apiKey: string };

export type DataSourceSecretResult =
  | { connected: false }
  | { connected: true; provider: "postgres"; secret: PostgresConnectorSecret }
  | { connected: true; provider: "mongodb"; secret: MongoConnectorSecret }
  | { connected: true; provider: "razorpay"; secret: RazorpayConnectorSecret }
  | { connected: true; provider: "stripe"; secret: StripeConnectorSecret };
