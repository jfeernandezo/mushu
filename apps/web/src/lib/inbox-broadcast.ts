import { createLogger } from '@mushu/shared/logger';
import { pubConnection } from './queue';

const logger = createLogger('web.inbox-broadcast');

/**
 * Server-side counterpart to `apps/worker/src/lib/inbox-broadcast.ts`. Same
 * channel naming + payload shape, so a subscriber to `inbox:org:<orgId>`
 * sees events from BOTH the worker (incoming Meta events, sent DMs) and the
 * web (manual sends, status changes).
 *
 * SSE clients live in `apps/web/src/app/api/inbox/stream/route.ts`.
 */
function channelFor(orgId: string): string {
  return `inbox:org:${orgId}`;
}

export type InboxEvent =
  | { kind: 'message_inserted'; conversationId: string; messageId: string }
  | { kind: 'conversation_updated'; conversationId: string };

export async function publishInboxEvent(orgId: string, event: InboxEvent): Promise<void> {
  try {
    await pubConnection().publish(channelFor(orgId), JSON.stringify(event));
  } catch (err) {
    logger.warn({ org_id: orgId, kind: event.kind, err }, 'publish failed');
  }
}
