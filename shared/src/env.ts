import { existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { z } from "zod";

for (const envFile of [
  join(process.cwd(), ".env.local"),
  join(process.cwd(), ".env"),
  join(process.cwd(), "..", "..", ".env.local"),
  join(process.cwd(), "..", "..", ".env"),
  join(__dirname, "..", "..", ".env.local"),
  join(__dirname, "..", "..", ".env"),
]) {
  if (existsSync(envFile)) {
    config({ path: envFile });
  }
}

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
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
  BILLING_SUBSCRIPTION_TOTAL_COUNT: z.coerce.number().int().positive().default(120),
  // Ad-hoc business_snapshot routing against a principal's own connected
  // Postgres/MongoDB/Razorpay accounts (separate from the two vars above,
  // which would be a single shared Razorpay account, not per-user vault creds).
  CONNECTOR_SCHEMA_CACHE_TTL_MS: z.coerce.number().int().positive().default(900_000),
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
  CALCOM_CLIENT_ID: z.string().optional(),
  CALCOM_CLIENT_SECRET: z.string().optional(),
  CALCOM_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/connectors/calcom/callback"),
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

export const env = parsed;
