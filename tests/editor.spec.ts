import { test, expect } from '@playwright/test'
import { captureScreenshot } from './utils'

async function loadSampleArchive(page) {
  const loadSampleButton = page.getByRole('button', { name: /^Load sample map$/ }).first()
  await loadSampleButton.click()
  await expect(page.getByText('sample archive loaded.', { exact: true })).toBeVisible({
    timeout: 30_000
  })
}

test.describe('editor panels & routing', () => {
  test('editor loads and imports sample archive', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible()

    await loadSampleArchive(page)
    const exportButton = page.getByRole('button', { name: /^Export WYN$/ }).first()
    await expect(exportButton).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor')
  })

  test('restores panel + layer from URL params', async ({ page }, testInfo) => {
    await page.goto('/editor/?panel=layers&layer=biome:forest&leo=1.4,0.55,0.62')
    await loadSampleArchive(page)
    await expect(page).toHaveURL(/panel=layers/)
    const dockButton = page.locator('.panel-dock__nav-button', { hasText: 'Layers' }).first()
    await expect(dockButton).toHaveClass(/panel-dock__nav-button--active/)
    const activeLayerLabel = page.locator('.layer-list__pill--active .layer-list__pill-label')
    await expect(activeLayerLabel).toHaveText(/forest/i)
    await captureScreenshot(page, testInfo, 'editor-layer-url-restore')
  })

  test('mask view toggle switches modes', async ({ page }, testInfo) => {
    await page.goto('/editor/?panel=layers&layer=biome:forest')
    await loadSampleArchive(page)
    const colourButton = page.getByRole('button', { name: /^Colour$/ })
    await colourButton.click()
    await expect(colourButton).toHaveClass(/segment-button--active/)
    await captureScreenshot(page, testInfo, 'editor-mask-view-colour')
  })
})
