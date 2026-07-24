import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from "@nestjs/microservices";
import { Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type {
  GmailPushJobData,
  GmailPushJobName,
} from "@heyriz/shared/queue/types";
import { captureException } from "@heyriz/shared/sentry";
import { SchedulerService } from "./scheduler.service";

@Injectable()
export class GmailPushWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<GmailPushJobData, void, GmailPushJobName>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  constructor(
    @Inject(SchedulerService)
    private readonly scheduler: SchedulerService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<GmailPushJobData, void, GmailPushJobName>(
      queueNames.gmailPush,
      async (job) => {
        const result = await this.processPush(job.data);
        logger.info("gmail push job completed", {
          jobId: job.id,
          accountId: job.data.accountId,
          historyId: job.data.historyId,
          result,
        });
      },
      {
        connection: createRedisConnection(),
        concurrency: 3,
      },
    );
    this.worker.on("failed", (job, error) => {
      captureException(error, { job: "gmail-push", jobId: job?.id });
      logger.error("gmail push job failed", {
        jobId: job?.id,
        accountId: job?.data.accountId,
        historyId: job?.data.historyId,
        error: error.message,
      });
    });
    logger.info("gmail push worker listening", { queue: queueNames.gmailPush });
  }

  async processPush(job: GmailPushJobData): Promise<{
    handled?: boolean;
    reason?: string;
    enqueued?: number;
    fallback?: boolean;
  }> {
    const result = await firstValueFrom(
      this.aiCore.send<{
        handled?: boolean;
        reason?: string;
        enqueued?: number;
        fallback?: boolean;
      }>("gmail.push.process", job),
    );
    if (result?.handled || result?.reason === "stale") {
      // A stale notification may be a retry after history was already
      // advanced. Waking automations again is safe because flow cursors and
      // deterministic queue job ids make dispatch idempotent.
      await this.scheduler.dispatchGmailAutomationsFromPush(job.userId);
    }
    return result ?? {};
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }
}
