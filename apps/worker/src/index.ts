import * as Sentry from '@sentry/node';

// Initialize Sentry as the very first thing so any throw during bootstrap
// is captured. SENTRY_DSN is opt-in — when unset (local dev, CI), Sentry
// becomes a no-op and we save the network calls.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    serverName: 'mushu-worker',
  });
}

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

  // Hourly token refresh sweep. The processor narrows to accounts whose
  // expires_at is within 7 days — most ticks find zero candidates, which is
  // cheap. Hourly cadence ensures we never miss the refresh window even if
  // the worker was down for a stretch.
  await maintenanceQueue.add(
    'refresh_meta_tokens',
    { kind: 'refresh_meta_tokens' },
    {
      repeat: { pattern: '17 * * * *' },
      jobId: 'recurring:refresh_meta_tokens',
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
