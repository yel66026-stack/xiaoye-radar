import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const root = resolve(import.meta.dirname)

const aliases = {
  '@xiaoye-radar/core': resolve(root, 'packages/core/src/index.ts'),
  '@xiaoye-radar/source-sdk': resolve(root, 'packages/source-sdk/src/index.ts'),
  '@xiaoye-radar/storage': resolve(root, 'packages/storage/src/index.ts'),
  '@xiaoye-radar/review-engine': resolve(root, 'packages/review-engine/src/index.ts'),
  '@xiaoye-radar/export': resolve(root, 'packages/export/src/index.ts'),
}

export default defineConfig({
  main: {
    resolve: { alias: aliases },
    build: {
      rollupOptions: {
        input: resolve(root, 'apps/community-desktop/src/main/index.ts'),
      },
    },
  },
  preload: {
    resolve: { alias: aliases },
    build: {
      rollupOptions: {
        input: resolve(root, 'apps/community-desktop/src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(root, 'apps/community-desktop/src/renderer'),
    resolve: { alias: aliases },
    plugins: [react()],
    build: {
      outDir: resolve(root, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(root, 'apps/community-desktop/src/renderer/index.html'),
      },
    },
  },
})
