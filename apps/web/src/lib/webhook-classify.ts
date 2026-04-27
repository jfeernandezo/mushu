/**
 * Resolve the canonical event type for a Meta messaging payload. Story
 * replies arrive as DMs with `message.reply_to.story` set; story mentions
 * arrive with an attachment of type `story_mention`. We tag them up-front so
 * the worker's trigger lookup can pick the right node type without re-parsing
 * the payload.
 *
 * Pure function — no side effects, no DB. Lives outside the route handler so
 * it can be unit-tested directly (apps/web/src/lib/__tests__/webhook-classify.test.ts).
 */
export type MessagingEventType =
  | 'message'
  | 'message_echo'
  | 'message_reaction'
  | 'message_seen'
  | 'story_reply'
  | 'story_mention';

export interface MessagingShape {
  message?: {
    is_echo?: boolean;
    reply_to?: { story?: unknown } | undefined;
    attachments?: Array<{ type: string }> | undefined;
  };
  reaction?: unknown;
  read?: unknown;
}

export function classifyMessagingType(
  m: MessagingShape,
  isEcho: boolean,
): MessagingEventType {
  if (isEcho) return 'message_echo';
  if (m.reaction) return 'message_reaction';
  if (m.read) return 'message_seen';
  if (m.message?.reply_to?.story) return 'story_reply';
  if (m.message?.attachments?.some((a) => a.type === 'story_mention')) {
    return 'story_mention';
  }
  return 'message';
}
