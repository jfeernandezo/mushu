import * as Sentry from '@sentry/nextjs';

// Edge runtime Sentry. Used for middleware and edge route handlers. We don't
// run anything important on edge today, so this is a defensive default — if
// SENTRY_DSN is set, edge errors get captured too.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  });
}
