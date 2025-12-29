import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import fs from 'node:fs'

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
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

export default defineConfig({
  base: './',
  publicDir: path.resolve(__dirname, '../public'),
  plugins: [vue(), versionHtmlPlugin],
  define: {
    __APP_VERSION__: JSON.stringify(versionShort),
    __APP_VERSION_FULL__: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: {
      '@connected-web/terrain-editor': path.resolve(__dirname, '../packages/terrain/src/index.ts')
    }
  },
  server: {
    port: 4175,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 2048
  }
})
