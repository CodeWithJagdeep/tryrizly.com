import type { Instrumentation } from "next";

// Inert until SENTRY_DSN is set — every deploy can ship this unconditionally.
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/node");
  Sentry.captureException(error, { extra: { path: request.path, method: request.method } });
};
