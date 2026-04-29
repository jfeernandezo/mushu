import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SCOPES = [
  'threads_basic',
  'threads_manage_replies',
  'threads_read_replies',
  'threads_manage_mentions',
];

/**
 * Start the Threads OAuth flow. Mirrors the Instagram start route — same
 * CSRF state-cookie pattern, same login redirect — but redirects to Threads'
 * authorize endpoint with the threads_* scopes.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(new URL('/login?next=/api/oauth/threads/start', base));
  }

  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.THREADS_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: 'app_not_configured' }, { status: 500 });
  }

  const state = generateState();
  const authorize = new URL('https://threads.net/oauth/authorize');
  authorize.searchParams.set('client_id', appId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', SCOPES.join(','));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('state', state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set('mushu_threads_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return res;
}

function generateState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}
