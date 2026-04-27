import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config. Picks up `*.test.ts` files anywhere under packages/ and
 * apps/, but EXCLUDES node_modules and dist. Each app/package can override
 * with its own config if needed.
 *
 * Environment defaults to `node` because Mushu is a server-heavy codebase —
 * the only client-side tests would need their own `vitest.config.ts` with
 * `environment: 'jsdom'`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/**/__tests__/**/*.test.ts',
      'apps/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts', 'apps/**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/dist/**', '**/.next/**'],
    },
    // Workspace-style import alias: @/ resolves to apps/web/src for tests
    // that touch web-side code.
    alias: {
      '@/': new URL('./apps/web/src/', import.meta.url).pathname,
    },
  },
});
