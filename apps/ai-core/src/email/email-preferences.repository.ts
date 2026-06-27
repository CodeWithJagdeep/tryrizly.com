import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { MongoClient } from "mongodb";
import { env } from "@heyriz/shared/env";
import type { EmailBehaviorPreference, EmailCategory } from "./email.types";

const inMemoryStore = new Map<string, EmailBehaviorPreference>();

function key(userId: string, category: EmailCategory) {
  return `${userId}:${category}`;
}

@Injectable()
export class EmailPreferencesRepository implements OnModuleDestroy {
  private client?: MongoClient;
  private ready = false;

  async onModuleInit() {
    if (!env.MONGODB_URL) return;
    try {
      this.client = new MongoClient(env.MONGODB_URL);
      await this.client.connect();
      await this.collection().createIndex(
        { userId: 1, category: 1 },
        { unique: true },
      );
      this.ready = true;
    } catch {
      this.client = undefined;
    }
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  async get(
    userId: string,
    category: EmailCategory,
  ): Promise<EmailBehaviorPreference | undefined> {
    if (this.ready && this.client) {
      const doc = await this.collection().findOne({ userId, category });
      return doc ? (doc as unknown as EmailBehaviorPreference) : undefined;
    }
    return inMemoryStore.get(key(userId, category));
  }

  async set(pref: EmailBehaviorPreference): Promise<void> {
    const record = { ...pref, updatedAt: new Date().toISOString() };
    if (this.ready && this.client) {
      await this.collection().updateOne(
        { userId: pref.userId, category: pref.category },
        { $set: record },
        { upsert: true },
      );
      return;
    }
    inMemoryStore.set(key(pref.userId, pref.category), record);
  }

  private collection() {
    return this.client!.db("heyriz").collection("email_preferences");
  }
}
