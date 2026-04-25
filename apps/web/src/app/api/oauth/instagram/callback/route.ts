import { db, instagramAccount } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';

/**
 * OAuth callback for connecting an Instagram Business/Creator account.
 *
 * Auth URL the user starts at (built by /api/oauth/instagram/start or a
 * Server Action — TODO):
 *
 *   https://www.instagram.com/oauth/authorize
 *     ?client_id=<META_APP_ID>
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
    return NextResponse.redirect(new URL(`/dashboard?ig_error=${error ?? 'no_code'}`, req.url));
  }

  // CSRF check: the state must match the cookie set in /start.
  const stateCookie = req.cookies.get('mushu_ig_oauth_state')?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL('/dashboard?ig_error=state_mismatch', req.url));
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL('/dashboard?ig_error=no_org', req.url));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
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
    const body = await shortRes.text();
    console.error('[oauth] short token exchange failed', body);
    return NextResponse.redirect(new URL('/dashboard?ig_error=token_exchange_failed', req.url));
  }
  const short = (await shortRes.json()) as ShortTokenResponse;

  // 2. Upgrade short → long-lived (60 days)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('access_token', short.access_token);
  const longRes = await fetch(longUrl);
  if (!longRes.ok) {
    const body = await longRes.text();
    console.error('[oauth] long token exchange failed', body);
    return NextResponse.redirect(new URL('/dashboard?ig_error=long_token_failed', req.url));
  }
  const long = (await longRes.json()) as LongTokenResponse;

  // 3. Fetch IG account info
  const meUrl = new URL('https://graph.instagram.com/me');
  meUrl.searchParams.set('fields', 'id,username,account_type');
  meUrl.searchParams.set('access_token', long.access_token);
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    return NextResponse.redirect(new URL('/dashboard?ig_error=me_failed', req.url));
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
    });
  }

  // TODO: subscribe to webhooks via Graph API once webhook URL is public.
  return NextResponse.redirect(new URL('/dashboard?ig_connected=1', req.url));
}
