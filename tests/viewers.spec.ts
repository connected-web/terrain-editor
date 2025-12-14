import { test, expect, Page } from '@playwright/test'
import { captureScreenshot } from './utils'

async function waitForStatus(page: Page, text: string | RegExp | readonly (string | RegExp)[]) {
  const overlayStatus = page.locator('.ctw-viewer-overlay__status')
  await expect(overlayStatus).toContainText(text, { timeout: 30_000 })
}

test.describe('Terrain Viewer : Basic interactions', () => {
  test('viewer loads sample terrain', async ({ page }, testInfo) => {
    await page.goto('/viewer-js/')
    await expect(page.getByRole('heading', { name: 'Terrain Viewer Demo' })).toBeVisible()
    await waitForStatus(page, 'Terrain loaded')
    await captureScreenshot(page, testInfo, 'viewer-ts')
  })
})
