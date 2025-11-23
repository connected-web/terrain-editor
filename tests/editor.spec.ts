import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

test('editor loads and imports sample archive', async ({ page }, testInfo) => {
  await page.goto('/editor/')
  await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible()

  await page.getByRole('button', { name: 'Load sample map' }).click()
  await expect(page.getByText('sample archive loaded.', { exact: true })).toBeVisible({
    timeout: 30_000
  })
  await expect(page.getByRole('button', { name: 'Export WYN' })).toBeVisible()
  await captureScreenshot(page, testInfo, 'editor')
})
