/**
 * Next.js instrumentation hook — runs once when the server process boots,
 * before any request is handled. Use to validate required configuration so
 * misconfigured deployments crash loudly at startup instead of producing
 * confusing 500s once a user touches the broken codepath.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only validate on the Node.js runtime — Edge runtime instances run a
  // different bundle and cannot reach Stripe anyway.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { getMode, HOSTED_REQUIRED_ENV } = await import('./src/lib/mode');
  const { HOSTED_EMAIL_REQUIRED_ENV } = await import('./src/lib/email');

  if (getMode() === 'hosted') {
    const missing = [...HOSTED_REQUIRED_ENV, ...HOSTED_EMAIL_REQUIRED_ENV].filter(
      (name) => !process.env[name]?.trim(),
    );
    if (missing.length > 0) {
      // Throwing here aborts server boot in production. In dev, Next prints the
      // stack and the dev server stays up but reload-loops — either way you
      // notice immediately.
      throw new Error(
        `[mushu] MUSHU_MODE=hosted but the following env vars are missing or empty: ${missing.join(', ')}. ` +
          'See docs/SELF_HOSTING.md for the hosted-mode setup, or unset MUSHU_MODE to run as a self-hosted instance.',
      );
    }
  }
}
