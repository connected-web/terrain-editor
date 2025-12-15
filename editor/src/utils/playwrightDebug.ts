/**
 * Playwright Debug Logging
 *
 * Enables verbose console logging when ?debug=PLAYWRIGHT is in the URL.
 * This is used during E2E tests to capture detailed logs without polluting production builds.
 */

let isPlaywrightDebug = false

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  isPlaywrightDebug = params.get('debug') === 'PLAYWRIGHT'

  // Always log the initialization so we can verify it's working
  console.log('[playwrightDebug] Module initialized, debug mode:', isPlaywrightDebug)
  console.log('[playwrightDebug] URL search params:', window.location.search)
}

/**
 * Log a message only when Playwright debug mode is enabled
 */
export function playwrightLog(...args: any[]) {
  if (isPlaywrightDebug) {
    console.log(...args)
  }
}

/**
 * Check if Playwright debug mode is enabled
 */
export function isPlaywrightDebugEnabled() {
  return isPlaywrightDebug
}
