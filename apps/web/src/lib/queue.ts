import { QUEUES, type ProcessEventJob, type SendMessageJob } from '@mushu/shared/queue';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let _connection: IORedis | undefined;
let _eventQueue: Queue<ProcessEventJob> | undefined;
let _messageQueue: Queue<SendMessageJob> | undefined;

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

export function getMessageQueue(): Queue<SendMessageJob> {
  if (_messageQueue) return _messageQueue;
  _messageQueue = new Queue<SendMessageJob>(QUEUES.messages, { connection: connection() });
  return _messageQueue;
}

/**
 * Enqueue a send-message job. Used by the inbox manual-send action — flow
 * automation paths enqueue directly from the worker. Pass flowExecutionId=''
 * for manual sends so the worker knows to skip flow-advance logic.
 */
export async function enqueueSendMessage(job: SendMessageJob): Promise<void> {
  const queue = getMessageQueue();
  await queue.add('send', job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 1000,
  });
}
