import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { INSTAGRAM_SCOPES } from '@/lib/instagram-oauth';
import { requireWorkspacePermission } from '@/lib/workspace-permission';

/**
 * Start the Instagram OAuth flow. Redirects the user to Meta's authorize
 * page with our app id, scopes, and a random CSRF state token. The callback
 * compares it with the HttpOnly cookie and checks the authenticated session.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(new URL('/login?next=/api/oauth/instagram/start', base));
  }

  const orgId = session.session.activeOrganizationId;
  if (orgId) {
    try {
      await requireWorkspacePermission(session.user.id, orgId, 'instagram.connect');
    } catch {
      return NextResponse.redirect(
        new URL('/settings/workspace?ig_error=permission_denied', req.url),
      );
    }
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.redirect(
      new URL('/settings/workspace?ig_error=app_not_configured', req.url),
    );
  }

  const state = generateState();
  const authorize = new URL('https://www.instagram.com/oauth/authorize');
  authorize.searchParams.set('client_id', appId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', INSTAGRAM_SCOPES.join(','));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('state', state);

  const res = NextResponse.redirect(authorize);
  // Short-lived HttpOnly cookie to verify state in the callback.
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
