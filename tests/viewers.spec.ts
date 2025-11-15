import { test, expect } from '@playwright/test'

const waitForStatus = async (page, text) => {
  await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout: 30_000 })
}

test('vanilla viewer loads sample terrain', async ({ page }) => {
  await page.goto('/viewer-js/')
  await expect(page.getByRole('heading', { name: 'Terrain Viewer Demo' })).toBeVisible()
  await waitForStatus(page, 'Terrain loaded')
})

test('vue viewer loads sample terrain', async ({ page }) => {
  await page.goto('/viewer-vue3/')
  await expect(page.getByText('Terrain Viewer Demo (Vue 3)')).toBeVisible()
  await waitForStatus(page, 'Terrain loaded')
})
