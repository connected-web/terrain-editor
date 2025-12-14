import fs from 'fs'
import { test, expect, Page } from '@playwright/test'
import { captureScreenshot } from './utils'
import { registerVideoRecordingHooks } from './video-utils'

async function loadSampleArchive(page: Page) {
  const loadSampleButton = page
    .getByRole('button', { name: /^Load sample map$/ })
    .first()

  await loadSampleButton.click()

  // Data loaded
  await expect(
    page.getByText('sample archive loaded.', { exact: true })
  ).toBeVisible({ timeout: 30_000 })

  // Visual readiness (pick something stable)
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 })

  // Optional: give WebGL a frame or two
  await page.waitForTimeout(300)
}


async function openPanel(page: Page, label: string, testInfo?: any) {
  // Use the toolbar button with aria-label (always visible)
  const toolbarButton = page.getByRole('button', { name: label });
  
  try {
    await toolbarButton.waitFor({ state: 'visible', timeout: 5000 });
    await toolbarButton.click();
    
    // Wait for the panel content to be visible
    await page.waitForSelector('.panel-card', { state: 'visible', timeout: 5000 });
    
    return toolbarButton;
  } catch (e) {
    if (testInfo) {
      await page.screenshot({ path: testInfo.outputPath(`openPanel-failure.png`) });
      const html = await page.content();
      fs.writeFileSync(testInfo.outputPath(`openPanel-failure.html`), html);
    }
    throw e;
  }
}

test.describe('Terrain Editor : Panels & routing', () => {
  test.use({ 
    viewport: { width: 1920, height: 1080 }
  })

  test('editor loads and imports sample archive', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)

    const exportButton = page
      .getByRole('button', { name: /^Export WYN$/ })
      .first()

    await expect(exportButton).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor')
  })

  test('workspace panel shows metadata form', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await openPanel(page, 'Workspace', testInfo)

    const labelInput = page
      .locator('.workspace-form__field', { hasText: 'Project title' })
      .locator('input')
      .first()

    await expect(labelInput).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor-workspace-panel')
  })

  test('theme panel exposes colour controls', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await openPanel(page, 'Theme', testInfo)

    await expect(
      page.getByRole('heading', { name: 'Labels' })
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-theme-panel')
  })

  test('locations panel enables add location flow', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await openPanel(page, 'Locations', testInfo)

    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()

    await captureScreenshot(page, testInfo, 'editor-locations-panel')
  })

  test('settings panel shows local options', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await openPanel(page, 'Settings', testInfo)

    await expect(
      page.getByText('Local to this browser')
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-settings-panel')
  })

  test('mask view toggle switches modes', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await page.goto('/editor/?panel=layers&layer=biome:forest')

    const colourButton = page.getByRole('button', { name: /^Colour$/ })
    await colourButton.click()

    await expect(colourButton).toHaveClass(
      /segment-button--active/
    )

    await captureScreenshot(page, testInfo, 'editor-mask-view-colour')
  })

  test('restores panel + layer from URL params', async ({ page }, testInfo) => {
    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await loadSampleArchive(page)
    await page.goto(
      '/editor/?panel=layers&layer=biome:forest&leo=1.4,0.55,0.62'
    )

    await expect(page).toHaveURL(/panel=layers/)

    const dockButton = page
      .locator('.panel-dock__nav-button', { hasText: 'Layers' })
      .first()

    await expect(dockButton).toHaveClass(
      /panel-dock__nav-button--active/
    )

    const activeLayerLabel = page.locator(
      '.layer-list__pill--active .layer-list__pill-label'
    )

    await expect(activeLayerLabel).toHaveText(/forest/i)
    await captureScreenshot(page, testInfo, 'editor-layer-url-restore')
  })
})

registerVideoRecordingHooks(test)