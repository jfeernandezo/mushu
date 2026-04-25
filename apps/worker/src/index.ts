import {
  type ExecuteFlowJob,
  type ProcessEventJob,
  QUEUES,
  type SendMessageJob,
  createWorker,
} from './queues.ts';
import { executeFlow } from './processors/execute-flow.ts';
import { processEvent } from './processors/process-event.ts';
import { sendMessage } from './processors/send-message.ts';

console.log('[mushu-worker] starting...');
console.log(`[mushu-worker] redis: ${process.env.REDIS_URL ?? 'redis://localhost:6379'}`);

const eventWorker = createWorker<ProcessEventJob>(QUEUES.events, processEvent);
const executionWorker = createWorker<ExecuteFlowJob>(QUEUES.executions, executeFlow);
const messageWorker = createWorker<SendMessageJob>(QUEUES.messages, sendMessage);

console.log('[mushu-worker] ready. workers running for:', Object.values(QUEUES).join(', '));

async function shutdown() {
  console.log('[mushu-worker] shutting down...');
  await Promise.all([eventWorker.close(), executionWorker.close(), messageWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
