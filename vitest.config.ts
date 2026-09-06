import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = resolve(import.meta.dirname)

export default defineConfig({
  resolve: {
    alias: {
      '@xiaoye-radar/core': resolve(root, 'packages/core/src/index.ts'),
      '@xiaoye-radar/source-sdk': resolve(root, 'packages/source-sdk/src/index.ts'),
      '@xiaoye-radar/storage': resolve(root, 'packages/storage/src/index.ts'),
      '@xiaoye-radar/review-engine': resolve(root, 'packages/review-engine/src/index.ts'),
      '@xiaoye-radar/export': resolve(root, 'packages/export/src/index.ts'),
    },
  },
  test: {
    coverage: { reporter: ['text', 'json-summary'] },
    include: ['tests/**/*.test.ts'],
  },
})
