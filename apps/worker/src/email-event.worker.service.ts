import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from "@nestjs/microservices";
import { Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type { EmailEventJobData, EmailEventJobName } from "@heyriz/shared/queue/types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";

@Injectable()
export class EmailEventWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<EmailEventJobData, void, EmailEventJobName>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  onModuleInit() {
    this.worker = new Worker<EmailEventJobData, void, EmailEventJobName>(
      queueNames.emailEvents,
      async (job) => {
        logger.info("email event job started", {
          jobId: job.id,
          messageId: job.data.messageId,
          source: job.data.source,
        });

        const result = await firstValueFrom(
          this.aiCore.send("email.process", job.data),
        );

        logger.info("email event job completed", {
          jobId: job.id,
          messageId: job.data.messageId,
          category: result?.category,
          handled: result?.handled,
        });
      },
      {
        connection: createRedisConnection(),
        concurrency: 3,
      },
    );

    this.worker.on("failed", (job, error) => {
      captureException(error, { job: "email-event", jobId: job?.id });
      logger.error("email event job failed", {
        jobId: job?.id,
        messageId: job?.data?.messageId,
        error: error.message,
      });
    });

    logger.info("email event worker listening", {
      queue: queueNames.emailEvents,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }
}
