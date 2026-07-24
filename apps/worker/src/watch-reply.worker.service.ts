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
import type {
  WatchReplyJobData,
  WatchReplyJobName,
} from "@heyriz/shared/queue/types";
import { enqueueWatchReply } from "@heyriz/shared/queue/watch-replies";
import { enqueueNotification } from "@heyriz/shared/queue/queues";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";

type CheckThreadReplyResult = {
  connected: boolean;
  hasReply: boolean;
  messageCount: number;
};

@Injectable()
export class WatchReplyWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<WatchReplyJobData, void, WatchReplyJobName>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  onModuleInit() {
    this.worker = new Worker<WatchReplyJobData, void, WatchReplyJobName>(
      queueNames.watchReplies,
      async (job) => {
        logger.info("watch reply job started", {
          jobId: job.id,
          threadId: job.data.threadId,
          attempt: job.data.attempt,
          maxAttempts: job.data.maxAttempts,
        });

        const result = await firstValueFrom(
          this.aiCore.send<CheckThreadReplyResult>("gmail.checkThreadReply", {
            userId: job.data.userId,
            accountId: job.data.accountId,
            threadId: job.data.threadId,
            baselineMessageCount: job.data.baselineMessageCount,
          }),
        );

        if (result.hasReply) {
          logger.info("watch reply satisfied", {
            jobId: job.id,
            threadId: job.data.threadId,
            messageCount: result.messageCount,
          });
          return;
        }

        if (job.data.attempt < job.data.maxAttempts) {
          const nextDelayMs = Math.min(
            job.data.nextDelayMs * 2,
            24 * 60 * 60_000,
          );
          await enqueueWatchReply({
            ...job.data,
            attempt: job.data.attempt + 1,
            maxAttempts: job.data.maxAttempts,
            nextDelayMs,
            delayMs: nextDelayMs,
          });
          logger.info("watch reply rescheduled", {
            jobId: job.id,
            threadId: job.data.threadId,
            nextAttempt: job.data.attempt + 1,
            delayMs: nextDelayMs,
          });
          return;
        }

        await enqueueNotification({
          userId: job.data.userId,
          message: job.data.fallbackMessage,
          source: "gmail",
        });
        logger.info("watch reply fallback sent", {
          jobId: job.id,
          threadId: job.data.threadId,
          connected: result.connected,
        });
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      },
    );

    this.worker.on("failed", (job, error) => {
      captureException(error, { job: "watch-reply", jobId: job?.id });
      logger.error("watch reply job failed", {
        jobId: job?.id,
        error: error.message,
      });
    });

    logger.info("watch reply worker listening", {
      queue: queueNames.watchReplies,
      framework: "nestjs",
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }
}
