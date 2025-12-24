/**
 * Playwright Debug Logging
 *
 * Enables verbose console logging when ?debug=PLAYWRIGHT is in the URL.
 * This is used during E2E tests to capture detailed logs without polluting production builds.
 */

import type { TerrainHandle } from '@connected-web/terrain-editor'

let isPlaywrightDebug = false

// Extend window interface for terrain viewer handle
declare global {
  interface Window {
    __terrainViewer?: TerrainHandle | null
  }
}

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  isPlaywrightDebug = params.get('debug') === 'PLAYWRIGHT'
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

/**
 * Expose terrain viewer handle to window for Playwright frame capture
 */
export function exposeTerrainViewer(handle: TerrainHandle | null) {
  if (typeof window !== 'undefined' && isPlaywrightDebug) {
    window.__terrainViewer = handle
    playwrightLog('[playwrightDebug] Exposed terrain viewer handle to window.__terrainViewer')
  }
}
