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
import type { SpineJobData, SpineJobName } from "@heyriz/shared/queue/types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

/**
 * Durable consumer for spine writes (timeline events + decision extraction).
 * Calls ai-core over TCP so the actual entity/event/decision logic stays in one
 * place. Retries + backoff come from the job options set at enqueue time; this
 * worker's only added duty is to shout loudly when a job exhausts its retries
 * (the dead-letter alert) instead of letting memory silently rot.
 */
@Injectable()
export class SpineWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<SpineJobData, void, SpineJobName>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  onModuleInit() {
    this.worker = new Worker<SpineJobData, void, SpineJobName>(
      queueNames.spine,
      async (job) => {
        logger.info("spine ingest job started", {
          jobId: job.id,
          messageId: job.data.messageId,
          extractDecisions: job.data.extractDecisions,
          attempt: job.attemptsMade + 1,
        });

        await firstValueFrom(this.aiCore.send("spine.ingestEmail", job.data));

        logger.info("spine ingest job completed", {
          jobId: job.id,
          messageId: job.data.messageId,
        });
      },
      {
        connection: createRedisConnection(),
        concurrency: 3,
      },
    );

    this.worker.on("failed", (job, error) => {
      const attempts = job?.opts.attempts ?? 1;
      const exhausted = job ? job.attemptsMade >= attempts : false;
      // exhausted === true means the job is now dead-lettered (retained 30d):
      // this is the signal worth paging on — memory that never got written.
      logger[exhausted ? "error" : "warn"](
        exhausted ? "spine ingest DEAD-LETTERED" : "spine ingest job failed (will retry)",
        {
          jobId: job?.id,
          messageId: job?.data?.messageId,
          attempt: job?.attemptsMade,
          maxAttempts: attempts,
          exhausted,
          error: error.message,
        },
      );
    });

    logger.info("spine worker listening", { queue: queueNames.spine });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }
}
