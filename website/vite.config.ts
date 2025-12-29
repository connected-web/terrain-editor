import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'node:path'
import fs from 'node:fs'

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
)
const versionShort = pkg.version.split('.').slice(0, 2).join('.')

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'assets/**/*',
          dest: 'assets'
        },
        {
          src: '../USER-GUIDE.md',
          dest: 'docs'
        },
        {
          src: '../documentation/WYN-FILE-FORMAT.md',
          dest: 'docs'
        },
        {
          src: '../documentation/images/**/*',
          dest: 'docs/images'
        },
        {
          src: '../documentation/animations/**/*',
          dest: 'docs/animations'
        }
      ]
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(versionShort),
    __APP_VERSION_FULL__: JSON.stringify(pkg.version)
  },
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
