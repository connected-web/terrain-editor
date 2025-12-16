import { test, expect, Page } from '@playwright/test'

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
 * The viewer emits lifecycle events and shows "Map ready." when rendering is complete.
 */
async function waitForMapReady(page: Page) {
  await expect(
    page.getByText('Map ready.', { exact: true })
  ).toBeVisible({ timeout: 60_000 })
}

test.describe('Terrain Editor : Navigation', () => {
  test.use({
    viewport: { width: 1280, height: 768 }
  })

  test('editor loads and shows export button', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample'))
    await expect(
      page.getByRole('heading', { name: 'Terrain Editor' })
    ).toBeVisible()

    await waitForMapReady(page)

    const exportButton = page
      .getByRole('button', { name: /^Export WYN$/ })
      .first()

    await expect(exportButton).toBeVisible()
  })

  test('workspace panel shows metadata form', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=workspace'))
    await waitForMapReady(page)

    const labelInput = page
      .locator('.workspace-form__field', { hasText: 'Project title' })
      .locator('input')
      .first()

    await expect(labelInput).toBeVisible()
  })

  test('theme panel shows colour controls', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=theme'))
    await waitForMapReady(page)

    await expect(
      page.getByRole('heading', { name: 'Labels' })
    ).toBeVisible()
  })

  test('locations panel shows add location button', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations'))
    await waitForMapReady(page)

    await expect(
      page.getByRole('button', { name: 'Add location' })
    ).toBeEnabled()
  })

  test('settings panel shows local options', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=settings'))
    await waitForMapReady(page)

    await expect(
      page.getByText('Local to this browser')
    ).toBeVisible()
  })

  test('layers panel shows layer list', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=layers'))
    await waitForMapReady(page)

    await expect(page).toHaveURL(/panel=layers/)
  })

  test('location selection via URL parameter', async ({ page }) => {
    await page.goto(addDebugParam('/editor/?autoload=sample&panel=locations&location=castle'))
    await waitForMapReady(page)

    const locationSelector = page.locator('.locations-panel__selector-button')
    await expect(locationSelector).toBeVisible()
    await expect(locationSelector).toContainText('Castle')
  })
})