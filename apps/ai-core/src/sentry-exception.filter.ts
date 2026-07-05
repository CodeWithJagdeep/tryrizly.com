import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { captureException } from "@heyriz/shared/sentry";
import { logger } from "@heyriz/shared/logger";

/**
 * Reports every exception crossing a TCP message handler to Sentry (a no-op
 * until SENTRY_DSN is set), then rethrows so NestJS's default microservice
 * error handling still runs exactly as before — this only adds a side report.
 */
@Catch()
export class SentryRpcExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost): never {
    captureException(exception);
    logger.error("ai-core: unhandled exception", {
      error: exception instanceof Error ? exception.message : String(exception),
    });
    throw exception;
  }
}
