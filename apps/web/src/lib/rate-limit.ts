import { getRedis } from './redis';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Fixed-window rate limit on a Redis key.
 *
 * Why fixed-window over sliding: simpler to reason about, costs 1 round-trip,
 * good enough for "block brute force" use cases where exact precision doesn't
 * matter. The worker uses a sliding window because it has to align with Meta's
 * per-hour API quotas.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const fullKey = `rl:${key}`;
  const count = await redis.incr(fullKey);
  if (count === 1) {
    await redis.expire(fullKey, windowSeconds);
  }
  const ttl = await redis.ttl(fullKey);
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() ?? 'unknown';
  return headers.get('x-real-ip') ?? 'unknown';
}
