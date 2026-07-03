import { Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { Redis } from "ioredis";
import { env } from "@heyriz/shared/env";

/**
 * Redis-backed rate limit counters so throttling is shared across every
 * gateway instance (and survives restarts), unlike the package's default
 * in-memory storage which only throttles within a single process.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:hits:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;

    const blockPttl = await this.redis.pttl(blockKey);
    if (blockPttl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockPttl / 1000),
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }
    const remainingPttl = await this.redis.pttl(hitKey);
    const timeToExpire = Math.ceil(Math.max(remainingPttl, 0) / 1000);

    if (totalHits > limit && blockDuration > 0) {
      await this.redis.set(blockKey, "1", "PX", blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }

    return { totalHits, timeToExpire, isBlocked: totalHits > limit, timeToBlockExpire: 0 };
  }
}
