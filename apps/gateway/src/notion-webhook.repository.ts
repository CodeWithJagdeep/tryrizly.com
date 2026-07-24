import { Injectable } from "@nestjs/common";
import { getDb } from "@heyriz/shared/db/mongo";

const KEY = "notion_webhook";

type NotionWebhookDoc = { key: string; token: string; updatedAt: string };

/**
 * Holds the single verification_token Notion hands us during its webhook
 * handshake — needed afterward as the HMAC secret for X-Notion-Signature on
 * every real event. One integration app, one token; no per-user scoping.
 */
@Injectable()
export class NotionWebhookRepository {
  private indexesReady?: Promise<void>;

  private ensureIndexes(): Promise<void> {
    this.indexesReady ??= (async () => {
      const db = await getDb();
      await db.collection("notion_webhook").createIndex({ key: 1 }, { unique: true });
    })().catch(() => undefined);
    return this.indexesReady;
  }

  async getVerificationToken(): Promise<string | undefined> {
    await this.ensureIndexes();
    const db = await getDb();
    const doc = await db.collection<NotionWebhookDoc>("notion_webhook").findOne({ key: KEY });
    return doc?.token;
  }

  async setVerificationToken(token: string): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db
      .collection<NotionWebhookDoc>("notion_webhook")
      .updateOne(
        { key: KEY },
        { $set: { key: KEY, token, updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
  }
}
