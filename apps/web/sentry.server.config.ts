import * as Sentry from '@sentry/nextjs';

// Server-side Sentry (Node.js runtime — request handlers, route handlers,
// server actions). Errors thrown here automatically reach Sentry via the
// Next.js integration when this file is loaded by `instrumentation.ts`.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    serverName: 'mushu-web',
  });
}
