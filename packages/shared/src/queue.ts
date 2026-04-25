/**
 * Queue names and job payload shapes shared between web (publisher) and
 * worker (consumer). No runtime deps on ioredis/bullmq — those are added
 * by each app independently.
 */

export const QUEUES = {
  events: 'mushu.events',
  executions: 'mushu.executions',
  messages: 'mushu.messages',
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
