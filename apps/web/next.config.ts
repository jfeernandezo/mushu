import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Allow workspace packages to be transpiled.
  transpilePackages: ['@mushu/db', '@mushu/shared'],
  serverExternalPackages: ['postgres'],
};

export default config;
