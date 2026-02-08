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
        scroll-behavior: auto !important;
      }
    `
  })
}

async function openLayerEditorForLayer(page: Page, label: string) {
  const pill = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
  await expect(pill).toBeVisible({ timeout: 30_000 })
  await page.evaluate((targetLabel) => {
    const scroll = document.querySelector('.layer-list__scroll') as HTMLElement | null
    if (!scroll) return
    const buttons = Array.from(scroll.querySelectorAll('button'))
    const target = buttons.find((btn) => btn.textContent?.toLowerCase().includes(targetLabel.toLowerCase()))
    if (target) {
      const rect = target.getBoundingClientRect()
      const scrollRect = scroll.getBoundingClientRect()
      scroll.scrollTop += rect.top - scrollRect.top - 24
    }
  }, label)
  await pill.click({ force: true })

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
