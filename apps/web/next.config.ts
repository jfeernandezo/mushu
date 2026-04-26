import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Tight CSP for production. `unsafe-inline` on script-src is required because
// Next.js App Router emits inline bootstrap scripts; replace with nonces in a
// future hardening pass. `unsafe-eval` is dev-only (RSC dev tooling) — strip
// it at build time below.
const cspDirectives = [
  "default-src 'self'",
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net",
  "font-src 'self' data:",
  "connect-src 'self' https://graph.instagram.com https://api.instagram.com https://graph.facebook.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

const securityHeaders = [
  // HSTS — only meaningful when served over HTTPS in production. Browsers
  // ignore it on plain HTTP, so it's safe to send everywhere.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone build copies only required files into .next/standalone — small
  // production image. With monorepo, set tracing root to repo root so
  // Drizzle/shared workspace packages get traced.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  // typedRoutes disabled for MVP — re-enable in v0.2 once we cast all
  // dynamic Link hrefs (AppSidebar items, /flows/[id], etc) with `as Route`.
  typedRoutes: false,
  // Allow workspace packages to be transpiled.
  transpilePackages: ['@mushu/db', '@mushu/shared'],
  serverExternalPackages: ['postgres'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(config);
