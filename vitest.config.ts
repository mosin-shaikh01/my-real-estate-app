import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    // The API is pure Node; the web tests need a DOM. Per-project environments
    // keep the Node tests fast rather than paying jsdom for all of them.
    projects: [
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['apps/api/test/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
        },
        resolve: { alias: { '@app/shared': r('./packages/shared/src/index.ts') } },
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/test/**/*.test.{ts,tsx}'],
          setupFiles: ['./apps/web/test/setup.ts'],
        },
        resolve: {
          alias: {
            '@app/shared': r('./packages/shared/src/index.ts'),
            '@': r('./apps/web/src'),
          },
        },
      },
    ],
  },
})
