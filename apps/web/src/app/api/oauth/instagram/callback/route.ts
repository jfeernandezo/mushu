import { dbAdmin as db, instagramAccount, notification, session as sessionTable } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { auth, ensureUserOrg } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import { subscribeInstagramWebhook } from '@/lib/meta-subscriptions';

const logger = createLogger('web.oauth.instagram');

function appUrl(path: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(path, base);
}

/**
 * OAuth callback for connecting an Instagram Business/Creator account.
 *
 * Auth URL the user starts at (built by /api/oauth/instagram/start or a
 * Server Action — TODO):
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

interface IgUser {
  id: string;
  username: string;
  account_type?: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(appUrl(`/dashboard?ig_error=${error ?? 'no_code'}`));
  }

  // CSRF check: the state must match the cookie set in /start.
  const stateCookie = req.cookies.get('mushu_ig_oauth_state')?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(appUrl('/dashboard?ig_error=state_mismatch'));
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
    return NextResponse.json({ error: 'app_not_configured' }, { status: 500 });
  }

  // 1. Exchange code → short-lived token
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
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
    return NextResponse.redirect(appUrl('/dashboard?ig_error=token_exchange_failed'));
  }
  const short = (await shortRes.json()) as ShortTokenResponse;

  // 2. Upgrade short → long-lived (60 days)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('access_token', short.access_token);
  const longRes = await fetch(longUrl);
  if (!longRes.ok) {
    logger.error({ http_status: longRes.status }, 'long token exchange failed');
    return NextResponse.redirect(appUrl('/dashboard?ig_error=long_token_failed'));
  }
  const long = (await longRes.json()) as LongTokenResponse;

  // 3. Fetch IG account info
  const meUrl = new URL('https://graph.instagram.com/me');
  meUrl.searchParams.set('fields', 'id,username,account_type');
  meUrl.searchParams.set('access_token', long.access_token);
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    return NextResponse.redirect(appUrl('/dashboard?ig_error=me_failed'));
  }
  const me = (await meRes.json()) as IgUser;

  // 4. Encrypt + upsert
  const encrypted = encryptToken(long.access_token);
  const expiresAt = new Date(Date.now() + long.expires_in * 1000);
  const igUserId = String(short.user_id);

  const existing = await db
    .select({ id: instagramAccount.id })
    .from(instagramAccount)
    .where(eq(instagramAccount.igUserId, igUserId))
    .limit(1);

  // Subscribe webhook BEFORE persisting so we can stamp webhookSubscribed
  // accurately on the new/updated row. A failed subscribe is non-fatal —
  // the user can retry from the workspace settings page (subscription is
  // idempotent on Meta's side).
  const subscribed = await subscribeInstagramWebhook({
    externalUserId: igUserId,
    accessToken: long.access_token,
  });
  if (!subscribed) {
    logger.warn({ ig_user_id: igUserId }, 'webhook subscribe failed — user can retry');
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
    body: 'Token saved (encrypted). Webhooks subscribe automatically once the public URL is configured.',
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

  return NextResponse.redirect(appUrl('/dashboard?ig_connected=1'));
}
