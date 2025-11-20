import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@connected-web/terrain-editor': path.resolve(__dirname, '../packages/terrain/src/index.ts')
    }
  },
  build: {
    chunkSizeWarningLimit: 2048
  }
})
