import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

test('editor loads and imports sample archive', async ({ page }, testInfo) => {
  await page.goto('/editor/')
  await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible()

  const loadSampleButton = page.getByRole('button', { name: /^Load sample map$/ }).first()
  await loadSampleButton.click()
  await expect(page.getByText('sample archive loaded.', { exact: true })).toBeVisible({
    timeout: 30_000
  })
  const exportButton = page.getByRole('button', { name: /^Export WYN$/ }).first()
  await expect(exportButton).toBeVisible()
  await captureScreenshot(page, testInfo, 'editor')
})
