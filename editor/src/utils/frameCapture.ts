/**
 * Frame Capture Utilities for Playwright Testing
 *
 * Provides functionality to composite UI elements onto the WebGL canvas
 * for high-quality video capture during E2E tests.
 */

import { snap } from 'snapdom'
import { isPlaywrightDebugEnabled } from './playwrightDebug'

/**
 * Composite UI elements onto the WebGL canvas for frame capture
 */
export async function captureCompositeFrame(): Promise<string> {
  const glCanvas = document.querySelector('canvas') as HTMLCanvasElement
  if (!glCanvas) throw new Error('WebGL canvas not found')

  // Create composite canvas
  const compositeCanvas = document.createElement('canvas')
  compositeCanvas.width = window.innerWidth
  compositeCanvas.height = window.innerHeight
  const ctx = compositeCanvas.getContext('2d')!

  // Draw WebGL canvas first
  ctx.drawImage(glCanvas, 0, 0)

  // Overlay UI elements
  const locationsPanel = document.querySelector('.locations-panel')
  if (locationsPanel) {
    try {
      const panelCanvas = await snap(locationsPanel as HTMLElement)
      const rect = locationsPanel.getBoundingClientRect()
      ctx.drawImage(panelCanvas, rect.left, rect.top)
    } catch (err) {
      console.warn('[frameCapture] Failed to render locations panel:', err)
    }
  }

  return compositeCanvas.toDataURL('image/png')
}

/**
 * Expose frame capture API to window for Playwright access
 */
export function exposeFrameCaptureAPI() {
  console.log('[frameCapture] exposeFrameCaptureAPI called, isPlaywrightDebugEnabled:', isPlaywrightDebugEnabled())
  if (typeof window !== 'undefined' && isPlaywrightDebugEnabled()) {
    (window as any).__captureCompositeFrame = captureCompositeFrame
    console.log('[frameCapture] ✓ Exposed composite frame capture API to window.__captureCompositeFrame')
  } else {
    console.log('[frameCapture] ✗ NOT exposing API - debug mode not enabled')
  }
}
