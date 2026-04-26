import IORedis from 'ioredis';

// Shared Redis client for non-queue uses (rate limiting, caching). BullMQ keeps
// its own connection in lib/queue.ts because it needs maxRetriesPerRequest:null.
let _client: IORedis | undefined;

export function getRedis(): IORedis {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required');
  _client = new IORedis(url, { lazyConnect: false });
  return _client;
}
