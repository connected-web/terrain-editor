import { test, expect, Page } from '@playwright/test'

function addDebugParam(url: string): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', 'PLAYWRIGHT')
  return urlObj.pathname + urlObj.search
}

function editorUrl(params: string): string {
  const trimmed = params ? (params.startsWith('&') ? params : `&${params}`) : ''
  return `/editor/?map=british-isles-terrain.wyn&renderScale=max${trimmed}`
}

async function waitForMapReady(page: Page) {
  await page.waitForFunction(
    () => {
      const viewer = (window as any).__terrainViewer
      if (!viewer || typeof viewer.getRenderResolution !== 'function') return false
      const res = viewer.getRenderResolution()
      return Boolean(res && res.width > 0 && res.height > 0)
    },
    null,
    { timeout: 60_000 }
  )
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

test.describe('Terrain Editor : Texture Layers', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('🟩 satellite texture layer shows guidance copy', async ({ page }) => {
    await page.goto(addDebugParam(editorUrl('panel=layers')))
    await waitForMapReady(page)
    await disableMotion(page)

    const editor = await openLayerEditorForLayer(page, 'Satellite')

    await expect(editor.getByText('Upload or select an RGBA asset from the layer’s assets dialog.')).toBeVisible()
    await expect(editor.getByText('Terrain editor does not yet support RGBA image editing.')).toBeVisible()
  })
})
