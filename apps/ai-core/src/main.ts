import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";
import { AiCoreModule } from "./ai-core.module";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AiCoreModule, {
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  await app.listen();

  logger.info("ai-core nest tcp listening", {
    host: env.AI_CORE_TCP_HOST,
    port: env.AI_CORE_TCP_PORT,
  });
}

bootstrap().catch((error) => {
  logger.error("ai-core failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
