import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
};

export default withNextIntl(config);
