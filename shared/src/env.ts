import { existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { z } from "zod";
import { resolveWebAppUrl } from "./web-app-url";

function environmentFileNames(nodeEnv: string | undefined): string[] {
  if (nodeEnv === "production") {
    return [".env.production.local", ".env.production", ".env"];
  }
  if (nodeEnv === "test") {
    return [".env.test.local", ".env.test", ".env"];
  }
  return [".env.local", ".env.development.local", ".env.development", ".env"];
}

const envRoots = [
  process.cwd(),
  join(process.cwd(), "..", ".."),
  join(__dirname, "..", ".."),
];

for (const envFile of envRoots.flatMap((root) =>
  environmentFileNames(process.env.NODE_ENV).map((name) => join(root, name)),
)) {
  if (existsSync(envFile)) {
    config({ path: envFile });
  }
}

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Error monitoring — inert (no Sentry.init call) when unset, in every service.
  SENTRY_DSN: z.string().optional(),
  GATEWAY_PORT: z.coerce.number().int().positive().default(4000),
  AI_CORE_TCP_HOST: z.string().default("127.0.0.1"),
  AI_CORE_TCP_PORT: z.coerce.number().int().positive().default(4100),
  BILLING_TCP_HOST: z.string().default("127.0.0.1"),
  BILLING_TCP_PORT: z.coerce.number().int().positive().default(4200),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  EXTRA_ORIGINS: z.string().optional(),
  NEXT_PUBLIC_GATEWAY_URL: z.string().url().default("http://localhost:4000"),
  AUTH_PORT: z.coerce.number().int().positive().optional(),
  AUTH_TCP_HOST: z.string().optional(),
  AUTH_TCP_PORT: z.coerce.number().int().positive().optional(),
  AUTH_JWT_SECRET: z.string().optional(),
  AUTH_JWT_EXPIRY: z.string().default("7d"),
  AUTH_INTERNAL_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  DATABASE_URL: z.string().optional(),
  MONGODB_URL: z.string().optional(),
  CONNECTOR_VAULT_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["rules", "grok", "openai"]).default("rules"),
  // Comma-separated emails allowed to see cross-user AI spend (admin usage digest/view).
  // The first entry is who the daily Telegram usage digest is sent to.
  ADMIN_EMAILS: z.string().optional(),
  // Web Push (browser notifications for users without Telegram linked)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:hello@getrizly.com"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  // Long-polling getUpdates instead of a webhook — no public HTTPS/domain needed.
  TELEGRAM_POLLING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Slack chat surface (DM with the Rizly bot) — distinct from the per-user
  // Slack read connector in ai-core. Bot token (xoxb-…) sends messages; the
  // app-level token (xapp-…, connections:write) opens Socket Mode, which —
  // like Telegram long-polling — needs no public HTTPS/domain.
  SLACK_SURFACE_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  // "Add to Slack" OAuth install (client credentials from the Slack app's
  // Basic Information page). Redirect URI must be HTTPS and registered on the
  // app's OAuth & Permissions page; unset in dev, where manual linking is used.
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SURFACE_REDIRECT_URI: z.string().optional(),
  SLACK_SOCKET_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Discord always-on surface bot (single global bot token — unlike Slack,
  // Discord bots are installed per-guild via OAuth but authenticate with one
  // app-wide token, not a per-workspace one). Gateway v10 socket connection
  // needs DISCORD_BOT_TOKEN + DISCORD_SOCKET_ENABLED; the "Add to Discord"
  // install link needs DISCORD_CLIENT_ID (+ SECRET for guild-install OAuth).
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_SURFACE_REDIRECT_URI: z.string().optional(),
  DISCORD_SOCKET_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  XAI_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().default("grok-4.3"),
  XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Default Claude model when a route names "anthropic" without a model.
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  // Small/fast model for inbox triage ("nano"). Falls back to the provider default.
  LLM_CLASSIFIER_MODEL: z.string().optional(),
  // Per-task model routing — "provider:model" (e.g. "openai:gpt-4o-mini",
  // "anthropic:claude-haiku-4-5", "grok"). Unset falls back to the code default.
  LLM_ROUTE_CLASSIFY: z.string().optional(),
  LLM_ROUTE_EXTRACT: z.string().optional(),
  LLM_ROUTE_DRAFT: z.string().optional(),
  LLM_ROUTE_MEMORY: z.string().optional(),
  LLM_ROUTE_BRIEF: z.string().optional(),
  LLM_ROUTE_AGENT: z.string().optional(),
  LLM_ROUTE_QUERY: z.string().optional(),
  LLM_ROUTE_DECIDE: z.string().optional(),
  // Vector memory: embeddings + time-aware, thresholded recall.
  EMBEDDINGS_MODEL: z.string().default("text-embedding-3-small"),
  // Must match the pgvector column. Changing it requires a deliberate memory
  // re-embedding migration; mismatched vectors are rejected instead of
  // corrupting recall.
  EMBEDDINGS_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  MEMORY_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.25),
  MEMORY_RECENCY_WEIGHT: z.coerce.number().min(0).max(1).default(0.2),
  MEMORY_RECENCY_HALFLIFE_DAYS: z.coerce.number().positive().default(30),
  MEMORY_MAX_CANDIDATES: z.coerce.number().int().positive().default(500),
  // Agent loop + proactive engine.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(12).default(6),
  // Optional background enrichment can spend LLM/embedding budget outside the
  // user-visible request. Keep it explicit so costs do not grow silently.
  BACKGROUND_AI_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  DEFAULT_USER_ID: z.string().default("default"),
  DEFAULT_TIMEZONE: z.string().default("UTC"),
  // How the agent addresses the principal in its replies (e.g. "sir", "ma'am").
  PRINCIPAL_HONORIFIC: z.string().default("sir"),
  MORNING_BRIEF_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  MEETING_SYNC_MINUTES: z.coerce.number().int().positive().default(5),
  EMAIL_POLL_MINUTES: z.coerce.number().int().positive().default(3),
  // Cadence for the flow-builder automation trigger poller (schedule/gmail/calendar).
  AUTOMATION_POLL_MINUTES: z.coerce.number().int().positive().default(5),
  // Independent from AGENT_MAX_STEPS: structured automations are deterministic
  // saved flows, so their explicit step budget must not inherit chat's small
  // free-form reasoning ceiling.
  AUTOMATION_MAX_STEPS: z.coerce.number().int().positive().max(100).default(50),
  // Production-safe by default. "expanded" is an explicit operator decision
  // after connector-specific evaluations pass; it must never happen merely
  // because code for a new catalog step exists.
  AUTOMATION_RELEASE_TIER: z.enum(["safe", "expanded"]).default("safe"),
  // Recency window (days) for inbox triage. Starred / Gmail-important mail is
  // always included regardless of age — importance beats a flat time cutoff.
  EMAIL_TRIAGE_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_STARTER_PLAN_ID: z.string().optional(),
  RAZORPAY_PRO_PLAN_ID: z.string().optional(),
  RAZORPAY_BUSINESS_PLAN_ID: z.string().optional(),
  // Dashboard-created Razorpay Offer applied to new Starter subscriptions
  // (intro pricing: first N cycles discounted). Offers have no create API, so
  // the id is provisioned by hand and injected here; unset = full price.
  RAZORPAY_STARTER_INTRO_OFFER_ID: z.string().optional(),
  BILLING_TRIAL_DAYS: z.coerce.number().int().min(0).default(10),
  BILLING_SUBSCRIPTION_TOTAL_COUNT: z.coerce
    .number()
    .int()
    .positive()
    .default(120),
  // Ad-hoc business_snapshot routing against a principal's own connected
  // Postgres/MongoDB/Razorpay accounts (separate from the two vars above,
  // which would be a single shared Razorpay account, not per-user vault creds).
  CONNECTOR_SCHEMA_CACHE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  CONNECTOR_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  CONNECTOR_MONGO_SAMPLE_SIZE: z.coerce.number().int().positive().default(20),
  CONNECTOR_SQL_ROW_LIMIT: z.coerce.number().int().positive().default(500),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/google/callback"),
  GOOGLE_LOGIN_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/auth/google/callback"),
  // Optional Gmail server-push delivery. When unset, the existing poller
  // remains authoritative. The topic project must match GOOGLE_CLIENT_ID's
  // Google Cloud project and grant Gmail's publisher service account access.
  GMAIL_PUBSUB_TOPIC: z.string().optional(),
  GMAIL_PUBSUB_VERIFICATION_TOKEN: z.string().min(24).optional(),
  GMAIL_PUBSUB_AUDIENCE: z.string().url().optional(),
  GMAIL_PUBSUB_SERVICE_ACCOUNT: z.string().email().optional(),
  // Cal.com's EU data-residency org (cal.eu) is a fully separate instance
  // from the global cal.com one - each needs its own approved OAuth client,
  // since a client created on one is unknown to the other. The plain data
  // API (bookings/event-types) stays on the global domain regardless; only
  // the OAuth handshake itself is regional.
  CALCOM_CLIENT_ID: z.string().optional(),
  CALCOM_CLIENT_SECRET: z.string().optional(),
  CALCOM_EU_CLIENT_ID: z.string().optional(),
  CALCOM_EU_CLIENT_SECRET: z.string().optional(),
  CALCOM_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/calcom/callback"),
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),
  NOTION_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/notion/callback"),
  NOTION_VERSION: z.string().default("2026-03-11"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/github/callback"),
  PAGERDUTY_CLIENT_ID: z.string().optional(),
  PAGERDUTY_CLIENT_SECRET: z.string().optional(),
  PAGERDUTY_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/pagerduty/callback"),
  // Stripe Apps OAuth. The client ID and mode-specific app developer key come
  // from Developers > Apps after uploading the public OAuth app. The secret
  // key is backend-only and must never be exposed through Next.js `env`.
  STRIPE_APP_CLIENT_ID: z.string().optional(),
  STRIPE_APP_SECRET_KEY: z.string().optional(),
  STRIPE_APP_AUTHORIZE_URL: z
    .string()
    .url()
    .default("https://marketplace.stripe.com/oauth/v2/authorize"),
  // Shopify custom-app OAuth. SHOPIFY_CLIENT_SECRET doubles as the HMAC key
  // for verifying X-Shopify-Hmac-Sha256 on incoming webhooks.
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_SCOPES: z.string().default("read_orders,read_inventory"),
  SHOPIFY_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/shopify/callback"),
  // Dropbox app secret also keys X-Dropbox-Signature on webhook notifications.
  DROPBOX_CLIENT_ID: z.string().optional(),
  DROPBOX_CLIENT_SECRET: z.string().optional(),
  DROPBOX_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/dropbox/callback"),
  // Atlassian OAuth 2.0 (3LO) app for Jira Cloud. Token exchange also requires
  // a follow-up call to the accessible-resources endpoint to get the cloudId
  // every subsequent Jira API call needs — see completeJiraOAuth.
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_SECRET: z.string().optional(),
  JIRA_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/jira/callback"),
  // Calendly OAuth app. Webhook subscriptions are still registered per
  // connected account (scope "user") using the OAuth access token in place
  // of the old pasted Personal Access Token — each subscription returns its
  // own signing key, stored on the account; there is no app-wide signing key.
  CALENDLY_CLIENT_ID: z.string().optional(),
  CALENDLY_CLIENT_SECRET: z.string().optional(),
  CALENDLY_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/calendly/callback"),
  // Figma OAuth app. Webhook signatures are keyed by a per-webhook "passcode"
  // we generate at registration time, not this secret.
  FIGMA_CLIENT_ID: z.string().optional(),
  FIGMA_CLIENT_SECRET: z.string().optional(),
  FIGMA_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/figma/callback"),
  // Airtable OAuth app. PKCE (S256) is mandatory on every request regardless
  // of confidential/public client — see startOAuth's airtable branch.
  AIRTABLE_CLIENT_ID: z.string().optional(),
  AIRTABLE_CLIENT_SECRET: z.string().optional(),
  AIRTABLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/airtable/callback"),
  STRIPE_APP_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/stripe/callback"),
  // Intuit (QuickBooks) OAuth2. Webhooks are configured once, app-wide, in the
  // Intuit Developer dashboard (not per-connection via API) — the verifier
  // token below is the app-level HMAC key Intuit signs every webhook with.
  QUICKBOOKS_CLIENT_ID: z.string().optional(),
  QUICKBOOKS_CLIENT_SECRET: z.string().optional(),
  QUICKBOOKS_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/quickbooks/callback"),
  INTUIT_WEBHOOK_VERIFIER_TOKEN: z.string().optional(),
  // Xero OAuth2 + webhooks. XERO_WEBHOOK_SIGNING_KEY is the app-level key from
  // the Xero app's Webhooks tab, used both for the intent-to-receive
  // handshake and every real event's x-xero-signature.
  XERO_CLIENT_ID: z.string().optional(),
  XERO_CLIENT_SECRET: z.string().optional(),
  XERO_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/xero/callback"),
  XERO_WEBHOOK_SIGNING_KEY: z.string().optional(),
  // Deel OAuth2. Endpoint URLs below are best-effort from Deel's public docs
  // at time of writing — verify against Deel's current developer docs before
  // relying on them in production (see connector.service.ts's Deel section).
  DEEL_CLIENT_ID: z.string().optional(),
  DEEL_CLIENT_SECRET: z.string().optional(),
  DEEL_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/deel/callback"),
  // Box OAuth2. Webhook signing keys are the two returned when the webhook is
  // registered (POST /2.0/webhooks) — stored per-connection, not env-level.
  BOX_CLIENT_ID: z.string().optional(),
  BOX_CLIENT_SECRET: z.string().optional(),
  BOX_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/box/callback"),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_SCOPES: z.string().default("openid profile email"),
  ZOHO_SMTP_HOST: z.string().optional(),
  ZOHO_SMTP_PORT: z.coerce.number().int().positive().optional(),
  ZOHO_SMTP_USER: z.string().optional(),
  ZOHO_SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
});

const parsed = schema.parse(process.env);
const normalized = {
  ...parsed,
  WEB_APP_URL: resolveWebAppUrl(parsed.WEB_APP_URL, parsed.NODE_ENV),
};

// Fail fast at boot rather than silently running open: in production the
// gateway's entire tenant isolation rests on these secrets, so a missing one
// must stop the process, not degrade to an unauthenticated/unsigned mode.
if (parsed.NODE_ENV === "production") {
  const missing = (["AUTH_INTERNAL_SECRET", "AUTH_JWT_SECRET"] as const).filter(
    (key) => !parsed[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start in production without required secrets: ${missing.join(", ")}`,
    );
  }
}

export const env = normalized;
