import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { env } from "@heyriz/shared/env";

export const CONVERSATION_STORE = Symbol("CONVERSATION_STORE");

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const TTL_SECONDS = 6 * 60 * 60; // 6 hours — long enough for a full workday
const MAX_TURNS = 20;
const keyFor = (chatId: string) => `heyriz:history:${chatId}`;

/**
 * Holds the last few turns of a Telegram chat so a follow-up reply ("today")
 * still makes sense to the agent on the next, separate chat.message call.
 * Keyed per chat, sliding TTL, capped length — this is short-term working
 * memory, distinct from the durable vector "memory" the agent recalls facts
 * from.
 */
export interface ConversationStore {
  get(chatId: string): Promise<ConversationTurn[]>;
  append(chatId: string, turn: ConversationTurn): Promise<void>;
  clear(chatId: string): Promise<void>;
}

/** In-process store: used in tests and as a single-instance fallback. */
export class MemoryConversationStore implements ConversationStore {
  private readonly map = new Map<string, { turns: ConversationTurn[]; expiresAt: number }>();

  async get(chatId: string): Promise<ConversationTurn[]> {
    const entry = this.map.get(keyFor(chatId));
    if (!entry) return [];
    if (Date.now() > entry.expiresAt) {
      this.map.delete(keyFor(chatId));
      return [];
    }
    return entry.turns;
  }

  async append(chatId: string, turn: ConversationTurn): Promise<void> {
    const turns = [...(await this.get(chatId)), turn].slice(-MAX_TURNS);
    this.map.set(keyFor(chatId), { turns, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  }

  async clear(chatId: string): Promise<void> {
    this.map.delete(keyFor(chatId));
  }
}

/** Production store: survives restarts and is shared across gateway instances. */
@Injectable()
export class RedisConversationStore implements ConversationStore, OnModuleDestroy {
  private readonly redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  async get(chatId: string): Promise<ConversationTurn[]> {
    const raw = await this.redis.get(keyFor(chatId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ConversationTurn[];
    } catch {
      return [];
    }
  }

  async append(chatId: string, turn: ConversationTurn): Promise<void> {
    const turns = [...(await this.get(chatId)), turn].slice(-MAX_TURNS);
    await this.redis.set(keyFor(chatId), JSON.stringify(turns), "EX", TTL_SECONDS);
  }

  async clear(chatId: string): Promise<void> {
    await this.redis.del(keyFor(chatId));
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
