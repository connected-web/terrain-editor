export type TerrainViewMode = 'embed' | 'popout' | 'fullscreen'

export type TerrainViewerHostOptions = {
  viewerElement: HTMLElement
  embedTarget: HTMLElement
  title?: string
  subtitle?: string
  documentRoot?: Document
  onModeChange?: (mode: TerrainViewMode) => void
}

export type TerrainViewerHostHandle = {
  openPopout: () => void
  closePopout: () => void
  toggleFullscreen: () => Promise<void>
  getMode: () => TerrainViewMode
  destroy: () => void
}

const HOST_STYLE_ID = 'ctw-viewer-host-style'
const HOST_CSS = `
.viewer-popout {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 13, 0.85);
  backdrop-filter: blur(6px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 999;
}

.viewer-popout.is-open {
  display: flex;
}

.viewer-popout.is-fullscreen {
  padding: 0;
}

.viewer-popout__chrome {
  width: min(1200px, 100%);
  height: min(90vh, 760px);
  background: #05070d;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-popout.is-fullscreen .viewer-popout__chrome {
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
}

.viewer-popout__header {
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-family: 'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif;
  color: #f6e7c3;
}

.viewer-popout__header .label {
  margin: 0;
  font-weight: 600;
}

.viewer-popout__header .hint {
  margin: 0;
  font-size: 0.85rem;
  color: #b8b2a3;
}

.viewer-popout__actions {
  display: flex;
  gap: 0.5rem;
}

.viewer-popout__slot {
  flex: 1;
  padding: 1rem;
}

.viewer-popout.is-fullscreen .viewer-popout__slot {
  padding: 0;
}

.chip-button {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f6e7c3;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
}

.chip-button:hover {
  border-color: rgba(223, 195, 135, 0.7);
}
`

const noopHandle: TerrainViewerHostHandle = {
  openPopout: () => {},
  closePopout: () => {},
  toggleFullscreen: () => Promise.resolve(),
  getMode: () => 'embed',
  destroy: () => {}
}

function ensureHostStyles(doc: Document) {
  if (doc.getElementById(HOST_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = HOST_STYLE_ID
  style.textContent = HOST_CSS
  doc.head.appendChild(style)
}

export function createTerrainViewerHost(options: TerrainViewerHostOptions): TerrainViewerHostHandle {
  if (typeof window === 'undefined') return noopHandle
  const { viewerElement, embedTarget } = options
  const doc = options.documentRoot ?? document
  if (!viewerElement || !embedTarget) return noopHandle

  ensureHostStyles(doc)

  let mode: TerrainViewMode = 'embed'
  let popoutOpen = false

  const overlay = doc.createElement('div')
  overlay.className = 'viewer-popout'
  overlay.setAttribute('aria-hidden', 'true')

  const chrome = doc.createElement('div')
  chrome.className = 'viewer-popout__chrome'
  overlay.appendChild(chrome)

  const popoutSlot = doc.createElement('div')
  popoutSlot.className = 'viewer-popout__slot'
  chrome.appendChild(popoutSlot)

  doc.body.appendChild(overlay)
  embedTarget.appendChild(viewerElement)

  function syncOverlayState() {
    overlay.classList.toggle('is-fullscreen', mode === 'fullscreen')
  }

  function setMode(newMode: TerrainViewMode) {
    if (mode === newMode) return
    mode = newMode
    syncOverlayState()
    options.onModeChange?.(mode)
  }

  function moveViewer(target: HTMLElement) {
    target.appendChild(viewerElement)
  }

  function openPopout() {
    if (popoutOpen) return
    popoutOpen = true
    overlay.classList.add('is-open')
    overlay.setAttribute('aria-hidden', 'false')
    moveViewer(popoutSlot)
    setMode('popout')
  }

  function closePopout() {
    if (!popoutOpen) return
    popoutOpen = false
    overlay.classList.remove('is-open')
    overlay.setAttribute('aria-hidden', 'true')
    moveViewer(embedTarget)
    if (doc.fullscreenElement === overlay) {
      void doc.exitFullscreen()
    }
    setMode('embed')
  }

  async function toggleFullscreen() {
    if (!popoutOpen) return
    if (doc.fullscreenElement === overlay) {
      await doc.exitFullscreen()
      setMode('popout')
    } else {
      await overlay.requestFullscreen()
      setMode('fullscreen')
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === overlay) {
      closePopout()
    }
  }

  function handleFullscreenChange() {
    if (!popoutOpen && doc.fullscreenElement === overlay) {
      void doc.exitFullscreen()
      return
    }
    if (!doc.fullscreenElement && popoutOpen) {
      setMode('popout')
    } else if (doc.fullscreenElement === overlay) {
      setMode('fullscreen')
    }
  }

  overlay.addEventListener('click', handleOverlayClick)
  doc.addEventListener('fullscreenchange', handleFullscreenChange)

  syncOverlayState()
  options.onModeChange?.(mode)

  return {
    openPopout,
    closePopout,
    toggleFullscreen,
    getMode: () => mode,
    destroy: () => {
      doc.removeEventListener('fullscreenchange', handleFullscreenChange)
      overlay.removeEventListener('click', handleOverlayClick)
      closePopout()
      overlay.remove()
    }
  }
}
