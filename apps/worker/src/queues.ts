import { createLogger } from '@mushu/shared/logger';
import { QUEUES, type QueueName } from '@mushu/shared/queue';
import * as Sentry from '@sentry/node';
import { Queue, QueueEvents, Worker, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';

const logger = createLogger('worker.queues');

export {
  type ExecuteFlowJob,
  type MaintenanceJob,
  type ProcessEventJob,
  QUEUES,
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
export const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });

export function createWorker<T>(
  queueName: QueueName,
  processor: (jobData: T) => Promise<void>,
  options: Partial<WorkerOptions> = {},
  onExhausted?: (jobData: T, error: Error) => Promise<void>,
) {
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      try {
        await processor(job.data);
      } catch (error) {
        if (onExhausted && job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
          await onExhausted(job.data, error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      ...options,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { queue: queueName, job_id: job?.id, attempts: job?.attemptsMade, err },
      'job failed',
    );
    // Send to Sentry on the FINAL failure (BullMQ retries up to attempts) so
    // we don't drown the inbox in transient errors that the retry loop will
    // swallow. `attemptsMade` is post-increment — equal to attempts when
    // there are no more retries.
    if (process.env.SENTRY_DSN && job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      Sentry.captureException(err, {
        tags: { queue: queueName, job_name: job.name },
        extra: { job_id: job.id, attempts: job.attemptsMade, data: job.data },
      });
    }
  });

  return worker;
}

export const eventQueueEvents = new QueueEvents(QUEUES.events, { connection });
