import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

const heroHeading = 'Craft and tune Wyn terrain maps in a full 3D editor — right in the browser.'

test.describe('Main Website', () => {
  test('website home renders hero and demo links', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: heroHeading })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Launch Viewer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Launch Editor' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'GitHub Project', exact: true })).toBeVisible()
    await captureScreenshot(page, testInfo, 'website-home')
  })
})
