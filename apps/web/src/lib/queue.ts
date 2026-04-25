import { QUEUES, type ProcessEventJob } from '@mushu/shared/queue';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let _connection: IORedis | undefined;
let _eventQueue: Queue<ProcessEventJob> | undefined;

function connection(): IORedis {
  if (_connection) return _connection;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required');
  }
  _connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  return _connection;
}

export function getEventQueue(): Queue<ProcessEventJob> {
  if (_eventQueue) return _eventQueue;
  _eventQueue = new Queue<ProcessEventJob>(QUEUES.events, { connection: connection() });
  return _eventQueue;
}

export async function enqueueProcessEvent(incomingEventId: string): Promise<void> {
  const queue = getEventQueue();
  await queue.add(
    'process',
    { incomingEventId },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 1000,
    },
  );
}
