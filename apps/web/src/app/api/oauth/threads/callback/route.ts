import { dbAdmin as db, instagramAccount, notification, session as sessionTable } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { auth, ensureUserOrg } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import { subscribeThreadsWebhook } from '@/lib/meta-subscriptions';

const logger = createLogger('web.oauth.threads');

function appUrl(path: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(path, base);
}

/**
 * OAuth callback for connecting a Threads account.
 *
 * Mirrors the Instagram callback structure:
 *   1. CSRF check via state cookie
 *   2. Exchange code → short-lived token (graph.threads.net)
 *   3. Upgrade to long-lived (60 day) token via th_exchange_token
 *   4. GET /me to resolve user id + username
 *   5. Encrypt token, upsert into instagram_account with channel='threads'
 *
 * The underlying table is shared with IG (named historically) — we just stamp
 * the new row with channel='threads' so worker/UI code can branch correctly.
 */

interface ShortTokenResponse {
  access_token: string;
  user_id: number | string;
  permissions?: string[];
}

interface LongTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ThreadsUser {
  id: string;
  username: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(appUrl(`/dashboard?threads_error=${error ?? 'no_code'}`));
  }

  const stateCookie = req.cookies.get('mushu_threads_oauth_state')?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(appUrl('/dashboard?threads_error=state_mismatch'));
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(appUrl('/login'));
  }

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    orgId = await ensureUserOrg(session.user.id);
    await db
      .update(sessionTable)
      .set({ activeOrganizationId: orgId })
      .where(eq(sessionTable.id, session.session.id));
  }

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json({ error: 'app_not_configured' }, { status: 500 });
  }

  // 1. Exchange code → short-lived token.
  const shortRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!shortRes.ok) {
    logger.error({ http_status: shortRes.status }, 'short token exchange failed');
    return NextResponse.redirect(appUrl('/dashboard?threads_error=token_exchange_failed'));
  }
  const short = (await shortRes.json()) as ShortTokenResponse;

  // 2. Upgrade short → long-lived (60 days).
  const longUrl = new URL('https://graph.threads.net/access_token');
  longUrl.searchParams.set('grant_type', 'th_exchange_token');
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('access_token', short.access_token);
  const longRes = await fetch(longUrl);
  if (!longRes.ok) {
    logger.error({ http_status: longRes.status }, 'long token exchange failed');
    return NextResponse.redirect(appUrl('/dashboard?threads_error=long_token_failed'));
  }
  const long = (await longRes.json()) as LongTokenResponse;

  // 3. Fetch Threads user info.
  const meUrl = new URL('https://graph.threads.net/v1.0/me');
  meUrl.searchParams.set('fields', 'id,username');
  meUrl.searchParams.set('access_token', long.access_token);
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    return NextResponse.redirect(appUrl('/dashboard?threads_error=me_failed'));
  }
  const me = (await meRes.json()) as ThreadsUser;

  // 4. Encrypt + upsert. Uniqueness is now (channel, ig_user_id), so we can
  // safely have a Threads account with the same numeric id as an IG account.
  const encrypted = encryptToken(long.access_token);
  const expiresAt = new Date(Date.now() + long.expires_in * 1000);
  const externalUserId = String(short.user_id ?? me.id);

  const existing = await db
    .select({ id: instagramAccount.id })
    .from(instagramAccount)
    .where(
      and(
        eq(instagramAccount.channel, 'threads'),
        eq(instagramAccount.igUserId, externalUserId),
      ),
    )
    .limit(1);

  const subscribed = await subscribeThreadsWebhook({
    externalUserId,
    accessToken: long.access_token,
  });
  if (!subscribed) {
    logger.warn({ external_user_id: externalUserId }, 'webhook subscribe failed — user can retry');
  }

  if (existing[0]) {
    await db
      .update(instagramAccount)
      .set({
        organizationId: orgId,
        igUsername: me.username,
        accessTokenEncrypted: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        expiresAt,
        webhookSubscribed: subscribed,
        updatedAt: new Date(),
      })
      .where(eq(instagramAccount.id, existing[0].id));
  } else {
    await db.insert(instagramAccount).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      channel: 'threads',
      igUserId: externalUserId,
      igUsername: me.username,
      accessTokenEncrypted: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      expiresAt,
      webhookSubscribed: subscribed,
    });
  }

  await db.insert(notification).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: session.user.id,
    type: 'threads_connected',
    title: `Threads connected: @${me.username}`,
    body: 'Token saved (encrypted). Webhook subscriptions for replies and mentions are configured in the Meta App Dashboard.',
    link: '/settings/workspace',
  });

  await recordAudit({
    orgId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.THREADS_CONNECT,
    targetType: 'threads_account',
    targetId: externalUserId,
    metadata: { threadsUsername: me.username },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  });

  return NextResponse.redirect(appUrl('/dashboard?threads_connected=1'));
}
