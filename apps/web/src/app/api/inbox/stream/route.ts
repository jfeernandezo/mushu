import { createLogger } from '@mushu/shared/logger';
import IORedis from 'ioredis';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { db, member } from '@mushu/db';
import { and, eq } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';

const logger = createLogger('web.inbox.stream');

/**
 * SSE endpoint for live inbox updates. One connection per browser tab; the
 * client (`apps/web/src/components/inbox/inbox-client.tsx`) opens an
 * `EventSource('/api/inbox/stream')` and refreshes its data when events come
 * in.
 *
 * Wire format: each Redis message is forwarded verbatim as a `data:` SSE
 * frame. The client doesn't try to interpret events — it just refetches list
 * + thread when anything arrives. That keeps the SSE side trivially small
 * (no schema versioning between worker/web/client) at the cost of an extra
 * round-trip per event.
 *
 * Heartbeat: a `: ping\n\n` comment every 25s prevents Cloudflare/Caddy/
 * nginx from timing out idle connections (default 60s).
 *
 * Auth: cookie-based session same as any other route. Permission gate:
 * `inbox.view` (without it, no point listening).
 */
const HEARTBEAT_INTERVAL_MS = 25_000;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) {
    return new Response('unauthorized', { status: 401 });
  }
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return new Response('no_active_org', { status: 400 });
  }

  // Permission check via the member row — same source the rest of the app
  // uses, so revoking inbox.view immediately closes future SSE attempts.
  const [me] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, orgId)))
    .limit(1);
  if (!me) {
    return new Response('not_a_member', { status: 403 });
  }
  if (!(await hasPermission(me.id, 'inbox.view'))) {
    return new Response('forbidden', { status: 403 });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error('REDIS_URL missing — cannot stream');
    return new Response('redis_not_configured', { status: 503 });
  }

  const channel = `inbox:org:${orgId}`;
  // Subscriber-mode connection — can NOT be reused for any other Redis
  // command. Hence a fresh ioredis per request.
  const subscriber = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      function send(payload: string) {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed — nothing to do.
        }
      }

      // Initial frame so the browser flips `EventSource.readyState` to OPEN
      // immediately even if no events arrive for a while.
      send(': connected\n\n');

      const heartbeat = setInterval(() => {
        send(': ping\n\n');
      }, HEARTBEAT_INTERVAL_MS);

      subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error({ org_id: orgId, err }, 'subscribe failed');
          controller.close();
        }
      });

      subscriber.on('message', (_chan, message) => {
        // SSE frame format: `data: <line>\n\n`. We forward the raw JSON the
        // publisher emitted; the client parses if it cares (current client
        // just triggers a refetch and ignores the payload).
        send(`data: ${message}\n\n`);
      });

      subscriber.on('error', (err) => {
        logger.error({ org_id: orgId, err }, 'subscriber error');
      });

      // When the client disconnects (tab closed, navigation, network drop),
      // tear down the Redis connection so we don't leak file descriptors.
      const cleanup = () => {
        clearInterval(heartbeat);
        try {
          subscriber.unsubscribe();
        } catch {
          // ignore
        }
        try {
          subscriber.disconnect();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener('abort', cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable Nginx/Caddy buffering — SSE is useless if the proxy holds
      // events to send in a chunk.
      'X-Accel-Buffering': 'no',
    },
  });
}
