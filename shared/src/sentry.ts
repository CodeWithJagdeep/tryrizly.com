import * as Sentry from "@sentry/node";
import { env } from "./env";
import { logger } from "./logger";

let initialized = false;

/**
 * Inert when SENTRY_DSN is unset — every service can call this unconditionally
 * at startup and it's a no-op until a real DSN is configured. Call once, as
 * early as possible in the entrypoint (before other imports that might throw).
 */
export function initSentry(service: string): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,
    serverName: service,
  });
  initialized = true;
  logger.info("sentry initialized", { service, environment: env.NODE_ENV });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
