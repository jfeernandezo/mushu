import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone build copies only required files into .next/standalone — small
  // production image. With monorepo, set tracing root to repo root so
  // Drizzle/shared workspace packages get traced.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  experimental: {
    typedRoutes: true,
  },
  // Allow workspace packages to be transpiled.
  transpilePackages: ['@mushu/db', '@mushu/shared'],
  serverExternalPackages: ['postgres'],
};

export default config;
