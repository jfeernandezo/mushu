import { toNextJsHandler } from 'better-auth/next-js';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const handler = toNextJsHandler(auth);

// Better Auth routes that mutate credentials. We rate-limit POSTs to these
// per IP to slow down brute-force attacks. Reads (session lookup) are not
// rate-limited — they happen on every page load and would lock real users out.
const RATE_LIMITED_PATHS = [
  '/sign-in',
  '/sign-up',
  '/change-password',
  '/forget-password',
  '/reset-password',
  '/delete-user',
];

const RATE_LIMIT_PER_15_MIN = 10;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function isRateLimited(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((p) => pathname.includes(p));
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // same-origin form posts don't send Origin
  const allowed = process.env.NEXT_PUBLIC_APP_URL;
  if (!allowed) return true; // dev / unconfigured: don't block
  try {
    return new URL(origin).origin === new URL(allowed).origin;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  // CORS / origin guard. Better Auth POSTs are state-changing — reject any
  // request that crosses origins (CSRF protection on top of the per-route
  // CSRF token Better Auth ships).
  if (!isAllowedOrigin(req.headers.get('origin'))) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }

  if (isRateLimited(req.nextUrl.pathname)) {
    const ip = clientIp(req.headers);
    const result = await rateLimit(
      `auth:${ip}`,
      RATE_LIMIT_PER_15_MIN,
      RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: 'too_many_requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.resetSeconds),
            'X-RateLimit-Limit': String(RATE_LIMIT_PER_15_MIN),
            'X-RateLimit-Remaining': String(result.remaining),
          },
        },
      );
    }
  }

  return handler.POST(req);
}
