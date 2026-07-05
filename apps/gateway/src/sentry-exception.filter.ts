import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { captureException } from "@heyriz/shared/sentry";
import { logger } from "@heyriz/shared/logger";

/**
 * Reports every unhandled exception to Sentry (a no-op until SENTRY_DSN is
 * set) without changing NestJS's existing HTTP error response behavior —
 * this filter forwards the same response NestJS would have sent anyway.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : { message: "Internal server error" };

    if (!isHttpException || status >= 500) {
      captureException(exception, { path: request?.url, method: request?.method });
      logger.error("unhandled exception", {
        path: request?.url,
        method: request?.method,
        error: exception instanceof Error ? exception.message : String(exception),
      });
    }

    response.status(status).json(typeof body === "string" ? { message: body } : body);
  }
}
