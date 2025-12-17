import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Add debug=PLAYWRIGHT parameter to a URL
 */
function addDebugParam(url: string): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', 'PLAYWRIGHT')
  return urlObj.pathname + urlObj.search
}

function editorUrl(params: string, location?: string): string {
  const trimmed = params ? (params.startsWith('&') ? params : `&${params}`) : ''
  const locationParam = location ? `&location=${encodeURIComponent(location)}` : ''
  return `/editor/?autoload=sample${trimmed}${locationParam}`
}

/**
 * Wait for the sample archive to be loaded and ready.
 * The viewer emits lifecycle events and shows "Map ready." when rendering is complete.
 */
async function waitForMapReady(page: Page) {
  await expect(
    page.getByText('Map ready.', { exact: true })
  ).toBeVisible({ timeout: 60_000 })
}

async function ensurePanelDockCollapsed(page: Page) {
  const dock = page.locator('.panel-dock').first()
  const toggle = page.locator('.panel-dock__toggle').first()

  await expect(toggle).toBeVisible()
  await expect(dock).toBeVisible()

  const isCollapsed = await dock.evaluate((el) => el.classList.contains('panel-dock--collapsed'))

  if (!isCollapsed) {
    await toggle.click()
    await expect(dock).toHaveClass(/panel-dock--collapsed/)
  }
}

async function openLayerEditorForLayer(page: Page, label: string) {
  const pill = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
  await expect(pill).toBeVisible({ timeout: 30_000 })
  await pill.click()

  const editor = page.locator('.layer-editor').first()
  await expect(editor).toBeVisible({ timeout: 30_000 })
  const titleInput = editor.locator('.layer-editor__title-input')
  await expect(titleInput).toBeVisible()
  const currentValue = (await titleInput.inputValue()).trim()
  expect(currentValue.toLowerCase()).toBe(label.toLowerCase())
  return editor
}

async function captureDocumentationScreenshot(page: Page, slug: string) {
  const outputDir = path.join(process.cwd(), 'documentation', 'images')
  fs.mkdirSync(outputDir, { recursive: true })

  await page.waitForTimeout(250)

  const outputPath = path.join(outputDir, `${slug}.png`)
  await page.screenshot({ path: outputPath, fullPage: true })

  console.log(`📸 Saved documentation screenshot: ${outputPath}`)
}

async function ensureMaskViewMode(page: Page, mode: 'grayscale' | 'color') {
  const editor = page.locator('.layer-editor').first()
  await expect(editor).toBeVisible()
  const button = editor.locator('.layer-editor__segment-button', {
    hasText: mode === 'color' ? /Colour/i : /B\/W/i
  })
  await expect(button).toBeVisible()
  const active = await button.evaluate((node) =>
    node.classList.contains('layer-editor__segment-button--active')
  )
  if (!active) {
    await button.click()
  }
  await expect(
    editor.locator('.layer-editor__segment-button--active', {
      hasText: mode === 'color' ? /Colour/i : /B\/W/i
    })
  ).toBeVisible()
}

test.describe('Terrain Editor : Navigation', () => {
  test.use({
    viewport: { width: 1920, height: 1080 }
  })

  test('🟦 Terrain Editor : Navigation › editor loads and shows export button', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('', 'River Delta')))
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await waitForMapReady(page)

    const exportButton = page
      .getByRole('button', { name: /^Export WYN$/ })
      .first()

    await expect(exportButton).toBeVisible()
    await ensurePanelDockCollapsed(page)
    await captureDocumentationScreenshot(page, 'editor-home')
  })

  test('🟩 Terrain Editor : Navigation › workspace panel shows metadata form', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=workspace', 'Cradle Lake')))
    await waitForMapReady(page)

    const labelInput = page
      .locator('.workspace-form__field', { hasText: 'Project title' })
      .locator('input')
      .first()

    await expect(labelInput).toBeVisible()
    await captureDocumentationScreenshot(page, 'panel-workspace')
  })

  test('🟩 Terrain Editor : Navigation › theme panel shows colour controls', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=theme', 'Faye Forest')))
    await waitForMapReady(page)

    await expect(
      page.getByRole('heading', { name: 'Labels' })
    ).toBeVisible()
    await captureDocumentationScreenshot(page, 'panel-theme')
  })

  test('🟩 Terrain Editor : Navigation › locations panel shows add location button', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=locations', 'Hornsdale')))
    await waitForMapReady(page)

    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()
    await captureDocumentationScreenshot(page, 'panel-locations')
  })

  test('🟩 Terrain Editor : Navigation › settings panel shows local options', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=settings', 'Valecourt')))
    await waitForMapReady(page)

    await expect(
      page.getByText('Local to this browser')
    ).toBeVisible()
    await captureDocumentationScreenshot(page, 'panel-settings')
  })

  test('🟧 Terrain Editor : Navigation › layers panel shows layer list', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=layers', 'Upper Scar')))
    await waitForMapReady(page)

    await expect(page).toHaveURL(/panel=layers/)
    await captureDocumentationScreenshot(page, 'panel-layers')
  })

  test('🟧 Terrain Editor : Navigation › location selection via URL parameter', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations&location=castle'))
    await waitForMapReady(page)

    const locationSelector = page.locator('.locations-panel__selector-button')
    await expect(locationSelector).toBeVisible()
    await expect(locationSelector).toContainText('Castle')

    await captureDocumentationScreenshot(page, 'panel-locations-selected-castle')
  })

  test('🟥 Terrain Editor : Navigation › layer editor height map view', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=layers', 'Mountain Rune Spur')))
    await waitForMapReady(page)

    const editor = await openLayerEditorForLayer(page, 'Height Map')
    await expect(editor.locator('.layer-editor__badge')).toContainText(/height/i)
    await page.waitForTimeout(750)

    await captureDocumentationScreenshot(page, 'layer-editor-height-map')
  })

  test('🟥 Terrain Editor : Navigation › layer editor forest biome view', async ({ page }) => {
    await page.goto(
      addDebugParam(
        '/editor/?autoload=sample&panel=layers&layer=biome%3Aforest&layers=LS%3AOVVVVVOHVVVVV%3ACL&leo=1.200%2C0.5037%2C0.6555'
      )
    )
    await waitForMapReady(page)

    const editor = page.locator('.layer-editor').first()
    await expect(editor).toBeVisible()
    await expect(editor.locator('.layer-editor__badge')).toContainText(/(biome|mask)/i)
    await ensureMaskViewMode(page, 'color')
    await page.waitForTimeout(3000)

    await captureDocumentationScreenshot(page, 'layer-editor-forest')
  })
})
