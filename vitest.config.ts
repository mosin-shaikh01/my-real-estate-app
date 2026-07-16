import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/*/test/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@app/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
})
