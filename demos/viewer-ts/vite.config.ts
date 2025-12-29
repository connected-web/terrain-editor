import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
)
const versionShort = pkg.version.split('.').slice(0, 2).join('.')
const versionHtmlPlugin = {
  name: 'inject-app-version',
  transformIndexHtml(html: string) {
    return html
      .replace(/%APP_VERSION%/g, versionShort)
      .replace(/%APP_VERSION_FULL%/g, pkg.version)
  }
}

// The VIEWER_TS_USE_PACKAGE environment variable controls whether the built package or the source code is used for alias resolution.
// Set VIEWER_TS_USE_PACKAGE='true' to use the built package (useful for testing the package as it would be consumed in production).
// Leave unset or set to any other value to use the source code directly (useful for local development and debugging).
const usePackageBuild = process.env.VIEWER_TS_USE_PACKAGE === 'true'

export default defineConfig({
  base: './',
  publicDir: path.resolve(__dirname, '../../public'),
  plugins: [versionHtmlPlugin],
  define: {
    __APP_VERSION__: JSON.stringify(versionShort),
    __APP_VERSION_FULL__: JSON.stringify(pkg.version)
  },
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
