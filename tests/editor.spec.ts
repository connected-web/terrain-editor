import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

test('editor loads and imports sample archive', async ({ page }, testInfo) => {
  await page.goto('/editor/')
  await expect(
    page.getByRole('heading', {
      name: 'Inspect and tweak Wyn archives in a browser-first workflow.'
    })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Load sample archive' }).click()
  await expect(page.getByText('sample archive loaded.', { exact: true })).toBeVisible({
    timeout: 30_000
  })
  await expect
    .poll(async () => {
      const value = await page.locator('textarea').first().inputValue()
      try {
        return JSON.parse(value)?.heightmap
      } catch {
        return null
      }
    }, { timeout: 15_000 })
    .toBe('layers/heightmap.png')
  await captureScreenshot(page, testInfo, 'editor')
})
