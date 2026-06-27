import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { env } from "@heyriz/shared/env";
import { GatewayModule } from "./gateway.module";
import { logger } from "@heyriz/shared/logger";

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  origins.add(env.WEB_APP_URL);
  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, {
    logger: ["error", "warn", "log"],
    rawBody: true,
  });
  const origins = allowedOrigins();
  app.enableCors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("cors_origin_denied"));
    },
    credentials: true,
  });

  await app.listen(env.GATEWAY_PORT);

  logger.info("gateway nest http listening", {
    port: env.GATEWAY_PORT,
    aiCoreTransport: "tcp",
    aiCoreHost: env.AI_CORE_TCP_HOST,
    aiCorePort: env.AI_CORE_TCP_PORT,
    billingHost: env.BILLING_TCP_HOST,
    billingPort: env.BILLING_TCP_PORT,
  });
}

bootstrap().catch((error) => {
  logger.error("gateway failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
