import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  
  return {
    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: 'src/assets/**/*',
            dest: 'assets'
          }
        ]
      })
    ],
    assetsInclude: ['**/*.svg'], // Explicitly treat SVGs as assets, not modules
    ssgOptions: {
      script: 'async',
      entry: './src/main.ssg.ts'
    }
  }
})
