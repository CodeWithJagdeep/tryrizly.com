// Inert until NEXT_PUBLIC_SENTRY_DSN is set — every deploy can ship this
// unconditionally. Uses NEXT_PUBLIC_ (not SENTRY_DSN) because this file runs
// in the browser; DSNs are meant to be public (they're write-only tokens).
import * as Sentry from "@sentry/browser";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });

  window.addEventListener("error", (event) => {
    Sentry.captureException(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    Sentry.captureException(event.reason);
  });
}
