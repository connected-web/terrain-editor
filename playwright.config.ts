import { defineConfig } from '@playwright/test'

const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4178)

export default defineConfig({
  testDir: './tests',
  testIgnore: ['tests/editor-user-guide-animated-features.spec.ts'],
  workers: process.env.CI ? '50%' : 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    headless: process.env.HEADLESS !== 'false',
    // Lower video resolution to 75% of default (e.g., 720p -> 540p)
    video: process.env.RECORD_VIDEO ? { mode: 'on', size: { width: 960, height: 540 } } : 'off',
    // Use a fresh context for each test to avoid localStorage pollution
    storageState: undefined,
    // Add more GPU flags for better hardware acceleration
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-accelerated-2d-canvas',
        '--enable-gpu',
        '--disable-software-rasterizer',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ],
  webServer: {
    command: 'npm run preview:dist',
    url: `http://127.0.0.1:${previewPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PREVIEW_PORT: String(previewPort) }
  }
})
