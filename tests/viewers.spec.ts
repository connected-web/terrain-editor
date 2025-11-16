import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

async function waitForStatus(page, text) {
  await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout: 30_000 })
}

test('vanilla viewer loads sample terrain', async ({ page }, testInfo) => {
  await page.goto('/viewer-js/')
  await expect(page.getByRole('heading', { name: 'Terrain Viewer Demo' })).toBeVisible()
  await waitForStatus(page, 'Terrain loaded')
  await captureScreenshot(page, testInfo, 'viewer-ts')
})

test('vue viewer loads sample terrain', async ({ page }, testInfo) => {
  await page.goto('/viewer-vue3/')
  await expect(page.getByText('Terrain Viewer Demo (Vue 3)')).toBeVisible()
  await waitForStatus(page, 'Terrain loaded')
  await captureScreenshot(page, testInfo, 'viewer-vue')
})
