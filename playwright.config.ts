import { defineConfig } from '@playwright/test'

const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4178)

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    headless: process.env.HEADLESS !== 'false',
    video: process.env.RECORD_VIDEO ? 'on' : 'off',
  },
  webServer: {
    command: `PREVIEW_PORT=${previewPort} npm run preview:dist`,
    url: `http://127.0.0.1:${previewPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
})