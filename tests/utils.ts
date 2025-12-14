import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'

const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots')

function ensureScreenshotDir() {
  mkdirSync(screenshotDir, { recursive: true })
}

export async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
  ensureScreenshotDir()
  await page.setViewportSize({ width: 1920, height: 1080 })
  const filePath = path.join(screenshotDir, `${name}.jpg`)
  await page.screenshot({
    path: filePath,
    fullPage: true,
    type: 'jpeg',
    quality: 65
  })
  await testInfo.attach(name, {
    path: filePath,
    contentType: 'image/jpeg'
  })
  return filePath
}
