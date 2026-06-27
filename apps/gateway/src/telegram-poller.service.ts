import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { TelegramService, type TelegramUpdate } from "./telegram.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { deleteTelegramWebhook, getTelegramUpdates } from "@heyriz/shared/telegram";

const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5000;

/**
 * Alternative to the webhook controller endpoint — long-polls Telegram for
 * updates instead, so the bot works without a public HTTPS domain. Enabled
 * via TELEGRAM_POLLING_ENABLED; the two transports are mutually exclusive
 * with Telegram (registering a webhook breaks polling and vice versa), so
 * this also clears any webhook on startup.
 */
@Injectable()
export class TelegramPollerService implements OnModuleInit, OnModuleDestroy {
  private offset = 0;
  private stopped = false;
  private loop?: Promise<void>;

  constructor(
    @Inject(TelegramService)
    private readonly telegram: TelegramService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!env.TELEGRAM_POLLING_ENABLED || !env.TELEGRAM_BOT_TOKEN) return;
    await deleteTelegramWebhook();
    logger.info("telegram long-polling started");
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        const updates = await getTelegramUpdates(this.offset, POLL_TIMEOUT_SECONDS);
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.telegram.handleUpdate(update as TelegramUpdate).catch((error) =>
            logger.error("telegram update handling failed", {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      } catch (error) {
        logger.warn("telegram getUpdates failed; retrying", {
          error: error instanceof Error ? error.message : String(error),
        });
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
