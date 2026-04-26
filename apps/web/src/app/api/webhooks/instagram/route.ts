import { dbAdmin as db, incomingEvent, instagramAccount } from '@mushu/db';
import { type WebhookPayload, webhookPayloadSchema } from '@mushu/shared/instagram';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/crypto';
import { enqueueProcessEvent } from '@/lib/queue';

/**
 * Meta webhook verification (one-time setup).
 *
 * Meta hits this with a GET like:
 *   ?hub.mode=subscribe&hub.verify_token=<our-token>&hub.challenge=<random>
 *
 * We must echo back hub.challenge if hub.verify_token matches the secret
 * we configured in the App Dashboard → Webhooks.
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
 * Webhook event ingestion. We MUST return 200 within ~5 seconds or Meta
 * retries (and disables the webhook after enough failures), so we:
 *   1. Verify HMAC
 *   2. Validate shape with Zod
 *   3. Insert into incoming_event (idempotent via eventId unique)
 *   4. Enqueue a job for the worker to process
 *   5. Return 200 immediately
 *
 * No business logic happens in this handler.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: 'app not configured' }, { status: 500 });
  }
  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let parsed: WebhookPayload;
  try {
    parsed = webhookPayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    console.error('[webhook] invalid payload', err);
    // Still return 200 — we don't want Meta to retry malformed payloads forever.
    return NextResponse.json({ ok: true, ignored: 'invalid_shape' });
  }

  for (const entry of parsed.entry) {
    // Resolve which IG account this event belongs to (by entry.id == ig_user_id).
    const [account] = await db
      .select({ id: instagramAccount.id })
      .from(instagramAccount)
      .where(eq(instagramAccount.igUserId, entry.id))
      .limit(1);

    if (entry.changes) {
      for (const change of entry.changes) {
        const eventId = `comment:${change.value.id}`;
        await persistEvent({
          eventId,
          accountId: account?.id ?? null,
          type: 'comment',
          payload: { entry, change },
        });
      }
    }

    if (entry.messaging) {
      for (const m of entry.messaging) {
        const mid = m.message?.mid ?? m.postback?.mid ?? `ts:${m.timestamp ?? Date.now()}`;
        const isEcho = m.message?.is_echo === true;
        const eventId = `dm:${mid}`;
        await persistEvent({
          eventId,
          accountId: account?.id ?? null,
          type: isEcho ? 'message_echo' : m.reaction ? 'message_reaction' : m.read ? 'message_seen' : 'message',
          payload: { entry, messaging: m },
        });
      }
    }
  }

  // TODO: enqueue process-event jobs in BullMQ once worker is wired.
  return NextResponse.json({ ok: true });
}

async function persistEvent(args: {
  eventId: string;
  accountId: string | null;
  type:
    | 'comment'
    | 'message'
    | 'message_echo'
    | 'message_reaction'
    | 'message_seen'
    | 'story_reply'
    | 'story_mention'
    | 'mention'
    | 'unknown';
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

  // Only enqueue if we actually inserted (not a Meta retry of an event we
  // already saw). Echoes and reactions are persisted but not enqueued.
  const isProcessable =
    args.type === 'comment' || args.type === 'message' || args.type === 'story_reply' || args.type === 'story_mention';
  if (inserted[0] && isProcessable) {
    try {
      await enqueueProcessEvent(inserted[0].id);
    } catch (err) {
      console.error('[webhook] failed to enqueue process-event', err);
      // Don't fail the webhook — we'll re-drive from incoming_event later via a
      // sweeper if needed. For now, log and move on.
    }
  }
}
