import { createLogger } from '@mushu/shared/logger';
import {
  type ExecuteFlowJob,
  type MaintenanceJob,
  type ProcessEventJob,
  QUEUES,
  type SendMessageJob,
  createWorker,
  maintenanceQueue,
} from './queues.ts';
import { executeFlow } from './processors/execute-flow.ts';
import { runMaintenance } from './processors/maintenance.ts';
import { processEvent } from './processors/process-event.ts';
import { sendMessage } from './processors/send-message.ts';

const logger = createLogger('worker.bootstrap');

logger.info({ redis: process.env.REDIS_URL ?? 'redis://localhost:6379' }, 'starting');

const eventWorker = createWorker<ProcessEventJob>(QUEUES.events, processEvent);
const executionWorker = createWorker<ExecuteFlowJob>(QUEUES.executions, executeFlow);
const messageWorker = createWorker<SendMessageJob>(QUEUES.messages, sendMessage);
// Maintenance worker has concurrency 1 — sweeps are sequential and slow
// (heavy DELETEs); no benefit from parallelism and we'd just contend on
// table locks.
const maintenanceWorker = createWorker<MaintenanceJob>(
  QUEUES.maintenance,
  runMaintenance,
  { concurrency: 1 },
);

await scheduleRecurringJobs();

logger.info({ queues: Object.values(QUEUES) }, 'ready');

async function scheduleRecurringJobs() {
  // Daily sweep at 03:00 UTC (00:00 BRT). Idempotent via jobId — re-runs of
  // this bootstrap won't duplicate the schedule.
  await maintenanceQueue.add(
    'sweep_incoming_events',
    { kind: 'sweep_incoming_events' },
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'recurring:sweep_incoming_events',
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
  logger.info('scheduled recurring jobs');
}

async function shutdown() {
  logger.info('shutting down');
  await Promise.all([
    eventWorker.close(),
    executionWorker.close(),
    messageWorker.close(),
    maintenanceWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
