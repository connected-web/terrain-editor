import { test, expect } from '@playwright/test'

const heroHeading = 'Build, edit, and explore Wyn terrain files directly in the browser.'

test('website home renders hero and demo links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: heroHeading })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Launch Viewer (TS)' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Launch Viewer (Vue)' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Editor Demo' })).toBeVisible()
})
