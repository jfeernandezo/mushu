import { createLogger } from '@mushu/shared/logger';
import { connection } from '../queues.ts';

const logger = createLogger('worker.inbox-broadcast');

/**
 * Channel names used by the inbox SSE bridge. One channel per org so
 * subscribers don't get fanout from other tenants.
 */
function channelFor(orgId: string): string {
  return `inbox:org:${orgId}`;
}

export type InboxEvent =
  | { kind: 'message_inserted'; conversationId: string; messageId: string }
  | { kind: 'conversation_updated'; conversationId: string };

/**
 * Publish an inbox event to all SSE subscribers of an org. Best-effort —
 * Redis publish failures are logged but never block the caller's primary
 * action (insert message, update conversation, etc.).
 *
 * Subscribers live in `apps/web/src/app/api/inbox/stream/route.ts`. Web
 * subscribes with its own ioredis connection (Redis pub/sub requires a
 * dedicated subscriber-mode connection — can't multiplex with publish).
 */
export async function publishInboxEvent(orgId: string, event: InboxEvent): Promise<void> {
  try {
    await connection.publish(channelFor(orgId), JSON.stringify(event));
  } catch (err) {
    logger.warn({ org_id: orgId, kind: event.kind, err }, 'publish failed');
  }
}
