import fs from 'fs'
import { test, expect, Page } from '@playwright/test'
import { captureScreenshot } from './utils'
import { saveVideoAsGif } from './video-utils'

async function loadSampleArchive(page: Page) {
  const loadSampleButton = page
    .getByRole('button', { name: /^Load sample map$/ })
    .first()

  await loadSampleButton.click()

  await expect(
    page.getByText('sample archive loaded.', { exact: true })
  ).toBeVisible({ timeout: 30_000 })
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
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      recordVideo: process.env.RECORD_VIDEO ? {
        dir: './test-results/videos',
        size: { width: 1024, height: 768 }
      } : undefined
    })
    page = await context.newPage()

    await page.goto('/editor/')
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    // 🔥 Load the heavy 3D map ONCE
    await loadSampleArchive(page)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('editor loads and imports sample archive', async ({}, testInfo) => {
    const exportButton = page
      .getByRole('button', { name: /^Export WYN$/ })
      .first()

    await expect(exportButton).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '01-editor-loads')
    }
  })

  test('workspace panel shows metadata form', async ({}, testInfo) => {
    await openPanel(page, 'Workspace', testInfo)

    const labelInput = page
      .locator('.workspace-form__field', { hasText: 'Project title' })
      .locator('input')
      .first()

    await expect(labelInput).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor-workspace-panel')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '02-workspace-panel')
    }
  })

  test('theme panel exposes colour controls', async ({}, testInfo) => {
    await openPanel(page, 'Theme', testInfo)

    await expect(
      page.getByRole('heading', { name: 'Labels' })
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-theme-panel')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '03-theme-panel')
    }
  })

  test('locations panel enables add location flow', async ({}, testInfo) => {
    await openPanel(page, 'Locations', testInfo)

    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()

    await captureScreenshot(page, testInfo, 'editor-locations-panel')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '04-locations-panel')
    }
  })

  test('settings panel shows local options', async ({}, testInfo) => {
    await openPanel(page, 'Settings', testInfo)

    await expect(
      page.getByText('Local to this browser')
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-settings-panel')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '05-settings-panel')
    }
  })

  test('mask view toggle switches modes', async ({}, testInfo) => {
    await page.goto('/editor/?panel=layers&layer=biome:forest')

    const colourButton = page.getByRole('button', { name: /^Colour$/ })
    await colourButton.click()

    await expect(colourButton).toHaveClass(
      /segment-button--active/
    )

    await captureScreenshot(page, testInfo, 'editor-mask-view-colour')
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '06-mask-view-toggle')
    }
  })

  test('restores panel + layer from URL params', async ({}, testInfo) => {
    await page.goto(
      '/editor/?panel=layers&layer=biome:forest&leo=1.4,0.55,0.62'
    )

    // No reload needed — map already loaded
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
    
    if (process.env.RECORD_VIDEO) {
      await saveVideoAsGif(testInfo, '07-url-restore')
    }
  })
})