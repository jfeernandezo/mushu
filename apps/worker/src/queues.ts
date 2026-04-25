import { Queue, QueueEvents, Worker, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUES, type QueueName } from '@mushu/shared/queue';

export {
  QUEUES,
  type ExecuteFlowJob,
  type ProcessEventJob,
  type QueueName,
  type SendMessageJob,
} from '@mushu/shared/queue';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export const eventQueue = new Queue(QUEUES.events, { connection });
export const executionQueue = new Queue(QUEUES.executions, { connection });
export const messageQueue = new Queue(QUEUES.messages, { connection });

export function createWorker<T>(
  queueName: QueueName,
  processor: (jobData: T) => Promise<void>,
  options: Partial<WorkerOptions> = {},
) {
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      await processor(job.data);
    },
    {
      connection,
      concurrency: 5,
      ...options,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[${queueName}] job ${job?.id} failed:`, err);
  });

  return worker;
}

export const eventQueueEvents = new QueueEvents(QUEUES.events, { connection });
