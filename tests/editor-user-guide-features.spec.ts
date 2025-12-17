import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  captureAnimationFrames,
  composeVideo,
  stitchFramesToVideo,
  videoNameFromTest
} from './video-utils'

process.env.RECORD_VIDEO = '1'

function addDebugParam(url: string): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', 'PLAYWRIGHT')
  return urlObj.pathname + urlObj.search
}

async function waitForMapReady(page: Page) {
  await expect(page.getByText('Map ready.', { exact: true })).toBeVisible({
    timeout: 60_000
  })
}

async function rescaleUI(page: Page) {
  const scale = 0.5
  await page.evaluate(() => {
    const editorLayout = document.querySelector<HTMLElement>('.editor-layout')
    if (editorLayout) editorLayout.style.zoom = String(scale)
  })
  await page.waitForTimeout(50)
  await page.evaluate(() => {
    const panelDock = document.querySelector<HTMLElement>('.panel-dock')
    if (panelDock) panelDock.style.height = Number(1 / scale * 100).toFixed(0) + 'vh'
  })
}

function duplicateFrames(frame: Buffer, seconds: number, fps: number): Buffer[] {
  const count = Math.max(1, Math.ceil(seconds * fps))
  return Array.from({ length: count }, () => frame)
}

function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

/**
 * Get a stable locator for the *visible* location picker dialog.
 * We anchor on .location-dialog and require it contains the heading.
 */
function locationDialog(page: Page): Locator {
  const heading = page.getByRole('heading', { name: 'Select a location' })
  return page.locator('.location-dialog').filter({ has: heading }).first()
}

async function openLocationDialog(page: Page, selectorButton: Locator) {
  const dialog = locationDialog(page)

  // Idempotent open: only click if not already visible
  const isVisible = await dialog.isVisible().catch(() => false)
  if (!isVisible) {
    await selectorButton.click()
  }

  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.locator('button.location-dialog__item').first()).toBeVisible({
    timeout: 30_000
  })

  return dialog
}

async function logLocationDialogContents(dialog: Locator) {
  const buttons = dialog.locator('button.location-dialog__item')
  const count = await buttons.count()

  const labels = (await buttons.locator('strong').allTextContents()).map((s) => s.trim())
  const fullTexts = (await buttons.allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim())

  console.log(`🧾 Location dialog: ${count} items`)
  console.log('🧾 Labels:', labels)
  console.log('🧾 Full button texts:', fullTexts)
}

/**
 * Find the button for a location name robustly.
 * - Uses a dedicated data attribute so punctuation / layout changes do not matter
 */
function locationItem(dialog: Locator, name: string): Locator {
  const attr = cssAttrEscape(name)
  return dialog
    .locator(`button.location-dialog__item[data-test-location="${attr}"]`)
    .first()
}

test.describe('Terrain Editor : User Guide Features', () => {
  test.use({ viewport: { width: 1280, height: 768 } })

  test('looping location demo capture', async ({ page }, testInfo) => {
    test.setTimeout(1_800_000)

    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations&location=castle'))
    await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible()

    await waitForMapReady(page)
    await rescaleUI(page)

    await expect(page.getByRole('button', { name: 'Add location' })).toBeEnabled()

    const selector = page.locator('.locations-panel__selector-button')
    await expect(selector).toBeVisible()

    await page.waitForTimeout(2000)

    if (!process.env.RECORD_VIDEO) return

    const outputName = `${videoNameFromTest(testInfo)}-${testInfo.project.name}`
    const fps = 30
    const timelineFrames: Buffer[] = []

    const hold = async (seconds: number) => {
      const shot = await page.screenshot({ type: 'png' })
      timelineFrames.push(...duplicateFrames(shot, seconds, fps))
    }

    const anim = async (seconds: number) => {
      const frames = await captureAnimationFrames(page, { fps, durationSeconds: seconds })
      timelineFrames.push(...frames)
    }

    const transitionTo = async (
      name: string,
      opts?: { hoverHold?: number; dialogHold?: number; afterHold?: number; animSeconds?: number }
    ) => {
      const dialogHold = opts?.dialogHold ?? 0.4
      const hoverHold = opts?.hoverHold ?? 0.25
      const afterHold = opts?.afterHold ?? 0.6
      const animSeconds = opts?.animSeconds ?? 0.9

      console.log(`🧭 Transition → ${name}`)

      const dialog = await openLocationDialog(page, selector)
      await logLocationDialogContents(dialog)

      // Pause only after the dialog is definitely rendered (so the pause shows the list)
      await hold(dialogHold)

      const item = locationItem(dialog, name)

      // Use a longer timeout here; if it fails, your log above will tell us what's in the list.
      await expect(item).toBeVisible({ timeout: 30_000 })

      await item.hover()
      await page.waitForTimeout(50)
      await hold(hoverHold)

      await item.click()
      await expect(dialog).not.toBeVisible({ timeout: 30_000 })

      await anim(animSeconds)
      await hold(afterHold)
    }

    let framesDir: string | undefined
    try {
      console.log('📸 Establishing hold')
      await hold(1.0)

      await transitionTo('Hornsdale')
      await transitionTo('River Delta')
      await transitionTo('Castle')

      await hold(1.0)

      const composed = await composeVideo({
        keyframes: [],
        animationFrames: timelineFrames,
        outputName,
        fps
      })
      framesDir = composed.framesDir
    } finally {
      if (framesDir) {
        stitchFramesToVideo({ framesDir, outputName, fps })
      }
    }
  })
})
