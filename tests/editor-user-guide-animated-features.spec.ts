import { test, expect } from '@playwright/test'
import {
  addDebugParam,
  captureAnimationFrames,
  composeVideo,
  duplicateFrames,
  locationItem,
  logLocationDialogContents,
  openLocationDialog,
  rescaleUI,
  stitchFramesToVideo,
  videoNameFromTest,
  waitForMapReady
} from './video-utils'
import { getShortVersion } from './utils'

process.env.RECORD_VIDEO = '1'

test.describe('Terrain Editor : User Guide Features', () => {
  test.use({ viewport: { width: 1280, height: 768 } })

  test('looping location demo capture', async ({ page }, testInfo) => {
    test.setTimeout(1_800_000)

    await page.goto(
      addDebugParam('/editor/?map=wynnal-terrain.wyn&renderScale=max&panel=locations&location=castle')
    )
    await expect(
      page.getByRole('heading', { name: `Terrain Editor v${getShortVersion()}` })
    ).toBeVisible()
    await rescaleUI(page)

    await waitForMapReady(page)

    await expect(page.getByRole('button', { name: 'Add location' })).toBeEnabled()

    const selector = page.locator('.locations-panel__selector-button')
    await expect(selector).toBeVisible()

    await page.waitForTimeout(500)

    if (!process.env.RECORD_VIDEO) return

    const outputName = `${videoNameFromTest(testInfo)}-${testInfo.project.name}`
    const fps = 30
    const timelineFrames: Buffer[] = []

    async function videoHold(seconds: number) {
      const shot = await page.screenshot({ type: 'png' })
      timelineFrames.push(...duplicateFrames(shot, seconds, fps))
    }

    async function videoAnim(seconds: number) {
      const frames = await captureAnimationFrames(page, { fps, durationSeconds: seconds })
      timelineFrames.push(...frames)
    }

    async function transitionToLocation(
      name: string,
      opts?: { hoverHold?: number; dialogHold?: number; afterHold?: number; animSeconds?: number }
    ) {
      const dialogHold = opts?.dialogHold ?? 0.4
      const hoverHold = opts?.hoverHold ?? 0.25
      const afterHold = opts?.afterHold ?? 0.6
      const animSeconds = opts?.animSeconds ?? 0.9

      console.log(`🧭 Transition → ${name}`)

      const dialog = await openLocationDialog(page, selector)
      await logLocationDialogContents(dialog)

      // Pause only after the dialog is definitely rendered (so the pause shows the list)
      await videoHold(dialogHold)

      const item = locationItem(dialog, name)

      // Use a longer timeout here; if it fails, your log above will tell us what's in the list.
      await expect(item).toBeVisible({ timeout: 30_000 })

      await item.hover()
      await page.waitForTimeout(50)
      await videoHold(hoverHold)

      await item.click()
      await expect(dialog).not.toBeVisible({ timeout: 30_000 })

      await videoAnim(animSeconds)
      await videoHold(afterHold)
    }

    let framesDir: string | undefined
    try {
      console.log('📸 Establishing hold')
      await videoHold(1.0)

      await transitionToLocation('Hornsdale')
      await transitionToLocation('River Delta')
      await transitionToLocation('Castle')

      await videoHold(1.0)

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
