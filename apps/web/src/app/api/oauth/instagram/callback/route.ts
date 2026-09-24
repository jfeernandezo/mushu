import { dbAdmin as db, instagramAccount, notification, session as sessionTable } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { auth, ensureUserOrg } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import {
  hasInstagramPermissions,
  instagramLongTokenSchema,
  parseInstagramToken,
} from '@/lib/instagram-oauth';
import { subscribeInstagramWebhook } from '@/lib/meta-subscriptions';

const logger = createLogger('web.oauth.instagram');

function appUrl(path: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(path, base);
}

/**
 * OAuth callback for connecting an Instagram Business/Creator account.
 *
 * Auth URL the user starts at (built by /api/oauth/instagram/start):
 *
 *   https://www.instagram.com/oauth/authorize
 *     ?client_id=<INSTAGRAM_APP_ID>
 *     &redirect_uri=<INSTAGRAM_OAUTH_REDIRECT_URI>
 *     &scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments
 *     &response_type=code
 *     &state=<random-csrf>
 *
 * Meta redirects here with ?code=... — we exchange for a short-lived token,
 * then upgrade to a 60-day long-lived token, fetch the IG user info, encrypt
 * and persist.
 */

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return oauthResult('ig_error', error ? 'access_denied' : 'no_code');
  }

  // CSRF check: the state must match the cookie set in /start.
  const stateCookie = req.cookies.get('mushu_ig_oauth_state')?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return oauthResult('ig_error', 'state_mismatch');
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(appUrl('/login'));
  }

  // Backfill: an existing user may have signed up before the org auto-create
  // hook landed and is therefore stuck without an active workspace. Create one
  // on the fly and patch the session row so subsequent requests see it too.
  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    orgId = await ensureUserOrg(session.user.id);
    await db
      .update(sessionTable)
      .set({ activeOrganizationId: orgId })
      .where(eq(sessionTable.id, session.session.id));
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return oauthResult('ig_error', 'app_not_configured');
  }

  // 1. Exchange code → short-lived token
  const shortRes = await metaRequest('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!shortRes?.ok) {
    logger.error({ http_status: shortRes?.status }, 'short token exchange failed');
    return oauthResult('ig_error', 'token_exchange_failed');
  }
  let short: ReturnType<typeof parseInstagramToken>;
  try {
    short = parseInstagramToken(await shortRes.json());
  } catch {
    return oauthResult('ig_error', 'token_exchange_failed');
  }
  if (!hasInstagramPermissions(short.permissions)) {
    return oauthResult('ig_error', 'missing_permissions');
  }

  // 2. Upgrade short → long-lived (60 days)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('access_token', short.access_token);
  const longRes = await metaRequest(longUrl);
  if (!longRes?.ok) {
    logger.error({ http_status: longRes?.status }, 'long token exchange failed');
    return oauthResult('ig_error', 'long_token_failed');
  }
  const longResult = instagramLongTokenSchema.safeParse(await longRes.json().catch(() => null));
  if (!longResult.success) return oauthResult('ig_error', 'long_token_failed');
  const long = longResult.data;

  // 3. Fetch IG account info
  const meUrl = new URL('https://graph.instagram.com/me');
  meUrl.searchParams.set('fields', 'id,username,account_type');
  meUrl.searchParams.set('access_token', long.access_token);
  const meRes = await metaRequest(meUrl);
  if (!meRes?.ok) {
    return oauthResult('ig_error', 'me_failed');
  }
  const meResult = z
    .object({ username: z.string().min(1), account_type: z.string().optional() })
    .safeParse(await meRes.json().catch(() => null));
  if (!meResult.success) return oauthResult('ig_error', 'me_failed');
  const me = meResult.data;

  // 4. Encrypt + upsert
  const encrypted = encryptToken(long.access_token);
  const expiresAt = new Date(Date.now() + long.expires_in * 1000);
  const igUserId = String(short.user_id);

  const existing = await db
    .select({ id: instagramAccount.id, organizationId: instagramAccount.organizationId })
    .from(instagramAccount)
    .where(and(eq(instagramAccount.igUserId, igUserId), eq(instagramAccount.channel, 'instagram')))
    .limit(1);

  // Connecting must never move an account (and its history) between workspaces.
  if (existing[0] && existing[0].organizationId !== orgId) {
    return oauthResult('ig_error', 'account_already_connected');
  }

  // Subscribe webhook BEFORE persisting so we can stamp webhookSubscribed
  // accurately on the new/updated row. A failed subscribe is non-fatal —
  // account can be reconnected after configuring the app-level webhook.
  const subscribed = await subscribeInstagramWebhook({
    externalUserId: igUserId,
    accessToken: long.access_token,
  });
  if (!subscribed) {
    logger.warn({ ig_user_id: igUserId }, 'webhook subscribe failed — integration needs attention');
  }

  if (existing[0]) {
    await db
      .update(instagramAccount)
      .set({
        igUsername: me.username,
        accessTokenEncrypted: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        expiresAt,
        webhookSubscribed: subscribed,
        updatedAt: new Date(),
      })
      .where(
        and(eq(instagramAccount.id, existing[0].id), eq(instagramAccount.organizationId, orgId)),
      );
  } else {
    await db.insert(instagramAccount).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      igUserId,
      igUsername: me.username,
      accessTokenEncrypted: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      expiresAt,
      webhookSubscribed: subscribed,
    });
  }

  // Drop a notification so the user sees confirmation in the bell + panel.
  await db.insert(notification).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: session.user.id,
    type: 'ig_connected',
    title: `Instagram connected: @${me.username}`,
    body: subscribed
      ? 'Instagram connected.'
      : 'Account connected. Event delivery needs attention in workspace settings.',
    link: '/settings/workspace',
  });

  await recordAudit({
    orgId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.IG_CONNECT,
    targetType: 'instagram_account',
    targetId: igUserId,
    metadata: { igUsername: me.username, accountType: me.account_type ?? null },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  });

  return oauthResult('ig_connected', subscribed ? '1' : 'webhook_pending');
}

function oauthResult(key: 'ig_error' | 'ig_connected', value: string) {
  const url = appUrl('/settings/workspace');
  url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.delete('mushu_ig_oauth_state');
  return response;
}

async function metaRequest(url: string | URL, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  } catch {
    // A fetch error can contain the URL (and token). Never log it verbatim.
    logger.warn({}, 'Instagram request failed or timed out');
    return null;
  }
}
