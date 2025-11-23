import { defineConfig } from 'vite'
import path from 'node:path'

// The VIEWER_TS_USE_PACKAGE environment variable controls whether the built package or the source code is used for alias resolution.
// Set VIEWER_TS_USE_PACKAGE='true' to use the built package (useful for testing the package as it would be consumed in production).
// Leave unset or set to any other value to use the source code directly (useful for local development and debugging).
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
