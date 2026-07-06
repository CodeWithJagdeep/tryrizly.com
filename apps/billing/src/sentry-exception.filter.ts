import { ArgumentsHost, Catch } from "@nestjs/common";
import { BaseRpcExceptionFilter } from "@nestjs/microservices";
import { captureException } from "@heyriz/shared/sentry";
import { logger } from "@heyriz/shared/logger";

/**
 * Reports every exception crossing a TCP message handler to Sentry (a no-op
 * until SENTRY_DSN is set), then defers to BaseRpcExceptionFilter so a real
 * error response still goes back over the TCP transport to the caller.
 *
 * A plain `throw` here (the previous implementation) does NOT do that: once
 * a catch-all `@Catch()` filter is registered, it IS the terminal handler —
 * Nest never falls back to default handling afterward. Re-throwing just
 * produces an unhandled rejection that never replies to the client.
 */
@Catch()
export class SentryRpcExceptionFilter extends BaseRpcExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    captureException(exception);
    logger.error("billing: unhandled exception", {
      error: exception instanceof Error ? exception.message : String(exception),
    });
    return super.catch(exception, host);
  }
}
