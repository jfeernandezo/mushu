/**
 * Queue names and job payload shapes shared between web (publisher) and
 * worker (consumer). No runtime deps on ioredis/bullmq — those are added
 * by each app independently.
 */

export const QUEUES = {
  events: 'mushu.events',
  executions: 'mushu.executions',
  messages: 'mushu.messages',
  /** Recurring background tasks (retention sweep, future cleanups). One worker
   *  per process is enough — these jobs are not throughput-critical. */
  maintenance: 'mushu.maintenance',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface ProcessEventJob {
  incomingEventId: string;
}

export interface ExecuteFlowJob {
  flowExecutionId: string;
}

export interface SendMessageJob {
  outgoingMessageId: string;
  flowExecutionId: string;
}

/**
 * Discriminated payload for the maintenance queue. Add new variants here
 * when introducing a new recurring job — keeps a single Worker dispatching
 * to the right processor.
 */
export type MaintenanceJob =
  | { kind: 'sweep_incoming_events' }
  | { kind: 'sweep_email_delivery' };
