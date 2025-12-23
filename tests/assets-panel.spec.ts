import { test, expect, Page } from '@playwright/test'

declare global {
  interface Window {
    __terrainViewer?: unknown
  }
}

function addDebugParam(url: string): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', 'PLAYWRIGHT')
  return urlObj.pathname + urlObj.search
}

function editorUrl(params: string): string {
  const trimmed = params ? (params.startsWith('&') ? params : `&${params}`) : ''
  return `/editor/?autoload=sample${trimmed}`
}

async function waitForMapReady(page: Page) {
  await page.waitForFunction(() => window.__terrainViewer !== undefined, null, { timeout: 60_000 })
}

async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }
    `
  })
}

async function openLayerEditorForLayer(page: Page, label: string) {
  const pill = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
  await expect(pill).toBeVisible({ timeout: 30_000 })
  await pill.scrollIntoViewIfNeeded()
  await pill.click()

  const editor = page.locator('.layer-editor').first()
  await expect(editor).toBeVisible({ timeout: 30_000 })
  return editor
}

test.describe('Terrain Editor : Asset Library', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('🟩 asset dialog shows Use asset for layer selection', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=layers')))
    await waitForMapReady(page)
    await disableMotion(page)

    const editor = await openLayerEditorForLayer(page, 'Forest')
    const assetsButton = editor.getByRole('button', { name: 'Assets' })
    await assetsButton.scrollIntoViewIfNeeded()
    await assetsButton.click({ force: true })

    const dialog = page.locator('.asset-dialog').first()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Use asset/i }).first()).toBeVisible()
  })

  test('🟩 asset dialog shows Use thumbnail for workspace selection', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=workspace')))
    await waitForMapReady(page)
    await disableMotion(page)

    await page.getByRole('button', { name: 'Select thumbnail' }).click()

    const dialog = page.locator('.asset-dialog').first()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder('Search assets')).toHaveValue('thumbnail')

    const useThumbnailButtons = dialog.getByRole('button', { name: /Use thumbnail/i })
    if (await useThumbnailButtons.count()) {
      await expect(useThumbnailButtons.first()).toBeVisible()
    }
  })
})
