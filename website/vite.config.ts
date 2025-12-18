import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'assets/**/*',
          dest: 'assets'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@connected-web/terrain-editor': path.resolve(
        __dirname,
        '../packages/terrain/src/index.ts'
      )
    }
  },
  server: {
    port: 4176,
    strictPort: true
  },
  assetsInclude: ['**/*.svg'],
  build: {
    chunkSizeWarningLimit: 2048
  }
})
