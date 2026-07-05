import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type { OutboundEmailJobData, OutboundEmailJobName } from "@heyriz/shared/queue/types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";

@Injectable()
export class OutboundEmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<OutboundEmailJobData, void, OutboundEmailJobName>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: env.AI_CORE_TCP_HOST, port: env.AI_CORE_TCP_PORT },
  });

  onModuleInit() {
    this.worker = new Worker<OutboundEmailJobData, void, OutboundEmailJobName>(
      queueNames.outboundEmail,
      async (job) => {
        const { userId, to, subject, body } = job.data;
        logger.info("outbound email job started", { jobId: job.id, to });

        await firstValueFrom(
          this.aiCore.send("tool.execute", {
            userId,
            name: "send_email",
            payload: { to, subject, body, approved: true },
            source: "scheduled",
          }),
        );

        logger.info("outbound email job completed", { jobId: job.id, to });
      },
      { connection: createRedisConnection(), concurrency: 2 },
    );

    this.worker.on("failed", (job, error) => {
      captureException(error, { job: "outbound-email", jobId: job?.id });
      logger.error("outbound email job failed", {
        jobId: job?.id,
        to: job?.data?.to,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    });

    logger.info("outbound email worker listening", { queue: queueNames.outboundEmail });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }
}
