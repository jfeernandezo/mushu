import { dbAdmin as db, incomingEvent, instagramAccount } from '@mushu/db';
import {
  type ThreadsWebhookPayload,
  threadsWebhookPayloadSchema,
} from '@mushu/shared/threads';
import { createLogger } from '@mushu/shared/logger';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/crypto';
import { enqueueProcessEvent } from '@/lib/queue';

const logger = createLogger('web.webhook.threads');

/**
 * Meta webhook verification handshake (one-time setup).
 *
 * Threads uses the same hub.challenge / hub.verify_token pattern as Instagram.
 * The verify token is shared between Threads and IG webhook subscriptions —
 * both come through the same Facebook App, and Meta only ever asks us to echo
 * back the challenge with the configured token.
 */
export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && challenge && token === expected) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

/**
 * Threads webhook ingestion. Same shape as the Instagram webhook handler:
 *   1. Verify HMAC against META_APP_SECRET (or THREADS_APP_SECRET if you
 *      registered Threads under a different App)
 *   2. Validate shape with Zod
 *   3. Resolve the account (by entry.id, channel='threads')
 *   4. Insert into incoming_event with type='threads_reply'/'threads_mention'
 *   5. Enqueue a process-event job
 *   6. Return 200 immediately (Meta retries on >5s)
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Threads is registered under the same Meta App as Instagram in most setups,
  // so we reuse META_APP_SECRET for HMAC. If you register Threads under a
  // separate App, swap this for THREADS_APP_SECRET.
  const appSecret = process.env.THREADS_APP_SECRET || process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: 'app not configured' }, { status: 500 });
  }
  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let parsed: ThreadsWebhookPayload;
  try {
    parsed = threadsWebhookPayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    logger.error({ err }, 'invalid payload');
    return NextResponse.json({ ok: true, ignored: 'invalid_shape' });
  }

  for (const entry of parsed.entry) {
    const [account] = await db
      .select({ id: instagramAccount.id })
      .from(instagramAccount)
      .where(
        and(
          eq(instagramAccount.channel, 'threads'),
          eq(instagramAccount.igUserId, entry.id),
        ),
      )
      .limit(1);

    if (!entry.changes) continue;
    for (const change of entry.changes) {
      const eventType =
        change.field === 'replies' ? 'threads_reply' : ('threads_mention' as const);
      const eventId = `${eventType}:${change.value.id}`;
      await persistEvent({
        eventId,
        accountId: account?.id ?? null,
        type: eventType,
        payload: { entry, change },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function persistEvent(args: {
  eventId: string;
  accountId: string | null;
  type: 'threads_reply' | 'threads_mention';
  payload: unknown;
}) {
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(incomingEvent)
    .values({
      id,
      eventId: args.eventId,
      instagramAccountId: args.accountId,
      type: args.type,
      payload: args.payload as object,
    })
    .onConflictDoNothing({ target: incomingEvent.eventId })
    .returning({ id: incomingEvent.id });

  if (inserted[0]) {
    try {
      await enqueueProcessEvent(inserted[0].id);
    } catch (err) {
      logger.error(
        { incoming_event_id: inserted[0].id, err },
        'failed to enqueue process-event',
      );
    }
  }
}
