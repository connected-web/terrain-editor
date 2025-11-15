import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'

const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots')

const ensureScreenshotDir = () => {
  mkdirSync(screenshotDir, { recursive: true })
}

export const captureScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  ensureScreenshotDir()
  await page.setViewportSize({ width: 800, height: 600 })
  const filePath = path.join(screenshotDir, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  await testInfo.attach(name, {
    path: filePath,
    contentType: 'image/png'
  })
  return filePath
}
