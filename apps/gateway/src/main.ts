import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { env } from "@heyriz/shared/env";
import { GatewayModule } from "./gateway.module";
import { logger } from "@heyriz/shared/logger";
import { initSentry, captureException } from "@heyriz/shared/sentry";
import { SentryExceptionFilter } from "./sentry-exception.filter";

initSentry("gateway");

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  origins.add(env.WEB_APP_URL);
  if (env.EXTRA_ORIGINS) {
    for (const o of env.EXTRA_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    }
  }
  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule, {
    logger: ["error", "warn", "log"],
    rawBody: true,
  });
  app.useGlobalFilters(new SentryExceptionFilter());
  // Marketing media (video/images) served directly from the gateway instead of
  // bundled into the Next.js app — keeps large binaries out of the web build.
  app.useStaticAssets(join(__dirname, "..", "public"), {
    maxAge: "30d",
    immutable: true,
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
  captureException(error);
  logger.error("gateway failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
