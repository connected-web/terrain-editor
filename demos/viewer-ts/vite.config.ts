import { defineConfig } from 'vite'
import path from 'node:path'

const usePackageBuild = process.env.VIEWER_TS_USE_PACKAGE === 'true'

export default defineConfig({
  base: './',
  resolve: {
    alias: usePackageBuild
      ? {}
      : {
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
