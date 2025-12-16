import { test, expect } from '@playwright/test'
import { captureFrames, stitchFramesToVideo, videoNameFromTest } from './video-utils'

process.env.RECORD_VIDEO = '1' // Enable video recording for these tests

/**
 * Add debug=PLAYWRIGHT parameter to a URL
 */
function addDebugParam(url: string): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', 'PLAYWRIGHT')
  return urlObj.pathname + urlObj.search
}

/**
 * Wait for the sample archive to be loaded and ready.
 */
async function waitForMapReady(page: any) {
  await expect(
    page.getByText('Map ready.', { exact: true })
  ).toBeVisible({ timeout: 60_000 })
}

test.describe('Terrain Editor : User Guide Features', () => {
  test.use({
    viewport: { width: 1280, height: 768 }
  })

  test('switching between locations', async ({ page }, testInfo) => {
    // Increase timeout for frame capture (can take a while)
    test.setTimeout(1_800_000) // 30 minutes

    // Load the editor with Castle location pre-selected
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations&location=castle'))
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    // Wait for map to be ready
    await waitForMapReady(page)

    // Wait for locations panel to be visible
    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()

    // Verify Castle is selected and camera has settled
    const locationSelectorButton = page.locator('.locations-panel__selector-button')
    await expect(locationSelectorButton).toBeVisible()
    await expect(locationSelectorButton).toContainText('Castle')

    // Wait for camera animation to Castle to complete
    await page.waitForTimeout(2000)

    // Set browser zoom to 90% for better UI visibility
    await page.evaluate(() => {
      document.body.style.zoom = '0.9'
    })

    // NOW we're ready to start recording - scene is loaded and stable
    if (process.env.RECORD_VIDEO) {
      const outputName = videoNameFromTest(testInfo)
      const fps = 30

      // Switch to River Delta to trigger the camera animation
      const pickerDialog = page.locator('.location-dialog')
      await locationSelectorButton.click()
      await expect(pickerDialog).toBeVisible()
      const riverButton = page.locator('.location-dialog__item').filter({ hasText: 'River Delta' })
      await expect(riverButton).toBeVisible()
      await riverButton.click()
      await expect(pickerDialog).not.toBeVisible()

      // Give a moment for the camera tween to be set up
      await page.waitForTimeout(100)

      // Calculate timing: 1s hold at start + 1s camera animation + 2s hold at end
      const totalDuration = 4

      // Capture all frames of the animation
      const { framesDir } = await captureFrames(page, {
        fps,
        durationSeconds: totalDuration,
        outputName
      })

      // Stitch frames into video
      stitchFramesToVideo({ framesDir, outputName, fps })
    } else {
      // Non-recording path: just perform the test actions
      await page.waitForTimeout(1000)
      await locationSelectorButton.click()
      const pickerDialog = page.locator('.location-dialog')
      await expect(pickerDialog).toBeVisible()
      const riverButton = page.locator('.location-dialog__item').filter({ hasText: 'River Delta' })
      await expect(riverButton).toBeVisible()
      await riverButton.click()
      await expect(pickerDialog).not.toBeVisible()
      await page.waitForTimeout(2000)
    }

    // Verify River Delta is now selected
    await expect(locationSelectorButton).toContainText('River Delta')
  })
})
