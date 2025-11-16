import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@connected-web/terrain-editor': path.resolve(
        __dirname,
        '../../packages/terrain/src/index.ts'
      )
    }
  },
  build: {
    chunkSizeWarningLimit: 2048
  }
})
