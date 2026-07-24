import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { enqueueEmailEvent } from "@heyriz/shared/queue/email-events";
import { enqueueGmailPush } from "@heyriz/shared/queue/gmail-push";
import type { GmailPushJobData } from "@heyriz/shared/queue/types";
import { ConnectorRepository } from "../connectors/connector.repository";
import type { ConnectedAccount } from "../connectors/connector.types";
import { GoogleService } from "../google/google.service";

export type GmailPushNotification = {
  emailAddress: string;
  historyId: string;
  pubsubMessageId: string;
};

type ProcessResult = {
  handled: boolean;
  reason?: "account_missing" | "disabled" | "stale" | "not_connected";
  enqueued?: number;
  fallback?: boolean;
};

const WATCH_ACTIVE_BUFFER_MS = 15 * 60_000;

@Injectable()
export class GmailPushService {
  constructor(
    @Inject(ConnectorRepository)
    private readonly connectors: ConnectorRepository,
    @Inject(GoogleService)
    private readonly google: GoogleService,
  ) {}

  async enqueueNotification(notification: GmailPushNotification) {
    const accounts = await this.connectors.findGmailAccountsByEmail(
      notification.emailAddress,
    );
    const jobs = await Promise.all(
      accounts.map((account) =>
        enqueueGmailPush({
          userId: account.userId,
          accountId: account.id,
          emailAddress: notification.emailAddress,
          historyId: notification.historyId,
          pubsubMessageId: notification.pubsubMessageId,
        }),
      ),
    );
    return { matched: accounts.length, queued: jobs.length };
  }

  async process(job: GmailPushJobData): Promise<ProcessResult> {
    const account = await this.connectors.findById(job.accountId);
    if (
      !account ||
      account.userId !== job.userId ||
      account.provider !== "gmail" ||
      account.status !== "connected"
    ) {
      return { handled: false, reason: "account_missing" };
    }

    if (account.metadata.autoProcess === false) {
      await this.connectors.advanceGmailHistoryCursor(
        account.id,
        account.userId,
        job.historyId,
      );
      return { handled: false, reason: "disabled" };
    }

    const cursor = this.historyCursor(account);
    if (cursor && BigInt(cursor) >= BigInt(job.historyId)) {
      return { handled: false, reason: "stale" };
    }

    let fallback = !cursor;
    let targetHistoryId = job.historyId;
    let messageIds: string[] = [];

    if (cursor) {
      const history = await this.google.listHistory(
        account.userId,
        cursor,
        account.id,
      );
      if (!history.connected) {
        return { handled: false, reason: "not_connected" };
      }
      fallback = history.history.historyExpired;
      targetHistoryId = maxNumericString(
        job.historyId,
        history.history.historyId,
      );
      messageIds = history.history.messageIds;
    }

    if (fallback) {
      const recent = await this.google.listThreads(
        account.userId,
        {
          q: "in:inbox is:unread newer_than:1h",
          maxResults: 100,
        },
        account.id,
      );
      if (!recent.connected) {
        return { handled: false, reason: "not_connected" };
      }
      messageIds = recent.messages.map((message) => message.id);
    }

    const uniqueMessageIds = [...new Set(messageIds)];
    let enqueued = 0;
    for (const messageId of uniqueMessageIds) {
      const result = await this.google.getMessage(
        account.userId,
        messageId,
        "metadata",
        account.id,
      );
      if (!result.connected) {
        throw new Error("gmail_push_message_fetch_disconnected");
      }
      const message = result.message;
      if (
        !message.labelIds.includes("INBOX") ||
        !message.labelIds.includes("UNREAD")
      ) {
        continue;
      }
      await enqueueEmailEvent({
        userId: account.userId,
        accountId: account.id,
        messageId: message.id,
        threadId: message.threadId,
        from: message.from,
        subject: message.subject,
        snippet: message.snippet,
        source: "push",
      });
      enqueued += 1;
    }

    // Advance only after every downstream email event is durably queued. A
    // failure before this point retries the same history range without a gap.
    await this.connectors.advanceGmailHistoryCursor(
      account.id,
      account.userId,
      targetHistoryId,
    );
    return { handled: true, enqueued, fallback };
  }

  async renewWatches(userId: string) {
    if (!isPushConfigured()) {
      return { configured: false, renewed: 0, failed: 0 };
    }
    const accounts = (await this.connectors.findAll(userId, "gmail")).filter(
      (account) =>
        account.status === "connected" &&
        account.metadata.autoProcess !== false,
    );
    let renewed = 0;
    let failed = 0;
    for (const account of accounts) {
      try {
        const result = await this.google.watchMailbox(
          userId,
          env.GMAIL_PUBSUB_TOPIC!,
          account.id,
        );
        if (!result.connected) {
          failed += 1;
          continue;
        }
        const recorded = await this.connectors.recordGmailWatch(
          account.id,
          userId,
          result.watch.historyId,
          result.watch.expiration,
        );
        if (recorded) renewed += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        logger.warn("gmail watch renewal failed", {
          userId,
          accountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { configured: true, renewed, failed };
  }

  async pushStatus(userId: string) {
    if (!isPushConfigured()) return { configured: false, active: false };
    const accounts = (await this.connectors.findAll(userId, "gmail")).filter(
      (account) =>
        account.status === "connected" &&
        account.metadata.autoProcess !== false,
    );
    const threshold = Date.now() + WATCH_ACTIVE_BUFFER_MS;
    const active =
      accounts.length > 0 &&
      accounts.every((account) => {
        const expiration = Number(account.metadata.gmailWatchExpiration ?? 0);
        return Number.isFinite(expiration) && expiration > threshold;
      });
    return { configured: true, active };
  }

  private historyCursor(account: ConnectedAccount): string | undefined {
    const value = String(account.metadata.gmailWatchHistoryId ?? "");
    return /^\d+$/.test(value) ? value : undefined;
  }
}

export function isPushConfigured(): boolean {
  return Boolean(
    env.GMAIL_PUBSUB_TOPIC &&
    env.GMAIL_PUBSUB_VERIFICATION_TOKEN &&
    env.GMAIL_PUBSUB_AUDIENCE &&
    env.GMAIL_PUBSUB_SERVICE_ACCOUNT,
  );
}

function maxNumericString(left: string, right: string): string {
  return BigInt(left) >= BigInt(right) ? left : right;
}
