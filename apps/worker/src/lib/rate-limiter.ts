import type IORedis from 'ioredis';

/**
 * Simple sliding-window rate limiter on Redis.
 *
 * Meta enforces ~200 messaging API calls per hour per IG account. We give
 * ourselves headroom and rate-limit at 180/hour by default.
 *
 * Implementation: sorted set keyed by accountId, scored by timestamp.
 * On `consume`, we ZADD now and ZRANGEBYSCORE [now-window, now] to count.
 * If count > limit, we reject. Set TTL on the key so it self-cleans.
 */
export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(
    private readonly redis: IORedis,
    options: RateLimitOptions = {},
  ) {
    this.limit = options.limit ?? 180;
    this.windowMs = options.windowMs ?? 60 * 60 * 1000;
  }

  /**
   * Try to consume one slot. Returns true if allowed, false if over the
   * limit. On false, the caller should re-enqueue with delay equal to
   * `retryAfterMs()` to spread load.
   */
  async consume(accountId: string): Promise<boolean> {
    const key = `mushu:rl:${accountId}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.pexpire(key, this.windowMs);
    const results = await pipeline.exec();
    if (!results) return false;

    const countResult = results[1];
    const count = (countResult?.[1] as number | null) ?? 0;
    return count < this.limit;
  }

  /**
   * Suggested delay (ms) before retrying after a rejected `consume`.
   * Returns ~1/limit of the window so retries spread out.
   */
  retryAfterMs(): number {
    return Math.floor(this.windowMs / this.limit);
  }
}
