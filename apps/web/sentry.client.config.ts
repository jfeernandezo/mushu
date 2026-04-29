import * as Sentry from '@sentry/nextjs';

// Browser-side Sentry. Uses NEXT_PUBLIC_SENTRY_DSN so the value gets baked
// into the client bundle. Opt-in: when the env var is unset, init is skipped
// entirely and the bundle still ships @sentry/nextjs (small fixed cost) but
// makes no outbound calls.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: Number.parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
    ),
    // Replays are off by default — they 10x the bundle size and we don't have
    // a real need yet. Flip to 0.1 sessionSampleRate when investigating UX bugs.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
