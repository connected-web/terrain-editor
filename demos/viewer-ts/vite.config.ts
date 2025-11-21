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
  server: {
    port: 4173,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 2048
  }
})
