import { test, expect, Page } from '@playwright/test'
import { captureScreenshot } from './utils'

async function loadSampleArchive(page: Page) {
  const loadSampleButton = page
    .getByRole('button', { name: /^Load sample map$/ })
    .first()

  await loadSampleButton.click()

  await expect(
    page.getByText('sample archive loaded.', { exact: true })
  ).toBeVisible({ timeout: 30_000 })
}

async function openPanel(page: Page, label: string) {
  const navButton = page
    .locator('.panel-dock__nav-button', { hasText: label })
    .first()

  await expect(navButton).toBeVisible({ timeout: 30_000 })
  await navButton.click()

  return navButton
}

test.describe('editor panels & routing', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
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
  })

  test('mask view toggle switches modes', async ({}, testInfo) => {
    await page.goto('/editor/?panel=layers&layer=biome:forest')

    const colourButton = page.getByRole('button', { name: /^Colour$/ })
    await colourButton.click()

    await expect(colourButton).toHaveClass(
      /segment-button--active/
    )

    await captureScreenshot(page, testInfo, 'editor-mask-view-colour')
  })

  test('workspace panel shows metadata form', async ({}, testInfo) => {
    await openPanel(page, 'Workspace')

    const labelInput = page
      .locator('.workspace-form__field', { hasText: 'Project title' })
      .locator('input')
      .first()

    await expect(labelInput).toBeVisible()
    await captureScreenshot(page, testInfo, 'editor-workspace-panel')
  })

  test('theme panel exposes colour controls', async ({}, testInfo) => {
    await openPanel(page, 'Theme')

    await expect(
      page.getByRole('heading', { name: 'Labels' })
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-theme-panel')
  })

  test('locations panel enables add location flow', async ({}, testInfo) => {
    await openPanel(page, 'Locations')

    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()

    await captureScreenshot(page, testInfo, 'editor-locations-panel')
  })

  test('settings panel shows local options', async ({}, testInfo) => {
    await openPanel(page, 'Settings')

    await expect(
      page.getByText('Local to this browser')
    ).toBeVisible()

    await captureScreenshot(page, testInfo, 'editor-settings-panel')
  })
})
