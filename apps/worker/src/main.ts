import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { logger } from "@heyriz/shared/logger";
import { initSentry, captureException } from "@heyriz/shared/sentry";
import { NotificationWorkerModule } from "./notification.module";

initSentry("worker");

async function bootstrap() {
  await NestFactory.createApplicationContext(NotificationWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  logger.info("notification worker app started");
}

bootstrap().catch((error) => {
  captureException(error);
  logger.error("notification worker failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
