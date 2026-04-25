import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
];

/**
 * Start the Instagram OAuth flow. Redirects the user to Meta's authorize
 * page with our app id, scopes, and a CSRF state token (signed with the
 * Better Auth secret so the callback can verify it without a session
 * lookup).
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(new URL('/login?next=/api/oauth/instagram/start', req.url));
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: 'app_not_configured' }, { status: 500 });
  }

  const state = generateState();
  const authorize = new URL('https://www.instagram.com/oauth/authorize');
  authorize.searchParams.set('client_id', appId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', SCOPES.join(','));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('state', state);

  const res = NextResponse.redirect(authorize);
  // Short-lived signed cookie to verify state in the callback.
  res.cookies.set('mushu_ig_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 min
  });
  return res;
}

function generateState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
