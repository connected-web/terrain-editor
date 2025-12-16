import { test, expect } from '@playwright/test'
import { registerVideoRecordingHooks } from './video-utils'

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
    viewport: { width: 1920, height: 1080 }
  })

  test('switching between locations', async ({ page }) => {
    // Load the editor with Castle location pre-selected
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations&location=castle'))
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    // Wait for map to be ready
    await waitForMapReady(page)

    // Wait for camera to navigate to Castle (deferred until viewer is ready)
    await page.waitForTimeout(1000)

    // Wait for locations panel to be visible
    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()

    // Verify Castle is selected
    const locationSelectorButton = page.locator('.locations-panel__selector-button')
    await expect(locationSelectorButton).toBeVisible()
    await expect(locationSelectorButton).toContainText('Castle')

    // Hold on Castle for a moment
    await page.waitForTimeout(2000)

    // Click the selector to open the picker
    await locationSelectorButton.click()

    // Wait for picker dialog to appear
    const pickerDialog = page.locator('.location-dialog')
    await expect(pickerDialog).toBeVisible()

    // Select River Delta location
    const riverButton = page.locator('.location-dialog__item').filter({ hasText: 'River Delta' })
    await expect(riverButton).toBeVisible()
    await riverButton.click()

    // Wait for picker to close
    await expect(pickerDialog).not.toBeVisible()

    // Wait for camera animation to complete (5 seconds)
    await page.waitForTimeout(2000)

    // Verify River Delta is now selected
    await expect(locationSelectorButton).toContainText('River Delta')

    // Hold on River Delta for video
    await page.waitForTimeout(2000)
  })
})

registerVideoRecordingHooks(test)
