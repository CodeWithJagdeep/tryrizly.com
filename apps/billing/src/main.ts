import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";
import { BillingModule } from "./billing.module";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { initSentry, captureException } from "@heyriz/shared/sentry";
import { SentryRpcExceptionFilter } from "./sentry-exception.filter";

initSentry("billing");

async function bootstrap() {
  const app = await NestFactory.createMicroservice(BillingModule, {
    transport: Transport.TCP,
    options: {
      host: env.BILLING_TCP_HOST,
      port: env.BILLING_TCP_PORT,
    },
  });

  app.useGlobalFilters(new SentryRpcExceptionFilter());
  await app.listen();

  logger.info("billing nest tcp listening", {
    host: env.BILLING_TCP_HOST,
    port: env.BILLING_TCP_PORT,
  });
}

bootstrap().catch((error) => {
  captureException(error);
  logger.error("billing failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
