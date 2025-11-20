const STYLE_ID = 'ctw-viewer-overlay-styles'

const OVERLAY_CSS = `
.ctw-viewer-host {
  position: relative;
}

.ctw-viewer-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.75rem;
  pointer-events: none;
  font-family: 'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif;
  color: #f6e7c3;
  z-index: 10;
}

.ctw-viewer-overlay__top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.ctw-viewer-overlay__status {
  font-size: 0.85rem;
  background: rgba(5, 7, 13, 0.6);
  border: 1px solid rgba(223, 195, 135, 0.5);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  backdrop-filter: blur(6px);
  line-height: 1.2rem;
}

.ctw-viewer-overlay__buttons {
  display: flex;
  gap: 0.35rem;
}

.ctw-chip-button {
  background: rgba(5, 7, 13, 0.65);
  border: 1px solid rgba(223, 195, 135, 0.5);
  color: #f6e7c3;
  border-radius: 999px;
  padding: 0.4rem 0.95rem;
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  pointer-events: auto;
  cursor: pointer;
  transition: border-color 0.2s ease;
  line-height: 1.2rem;
}

.ctw-chip-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ctw-chip-button:not(:disabled):hover {
  border-color: rgba(223, 195, 135, 0.85);
}

.ctw-drop-overlay {
  position: absolute;
  inset: 0;
  border: 2px dashed rgba(223, 195, 135, 0.75);
  border-radius: 16px;
  background: rgba(5, 7, 13, 0.82);
  display: none;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  z-index: 9;
}

.ctw-viewer-host--dragging .ctw-drop-overlay {
  display: flex;
}
`

import { TerrainViewMode } from './viewerHost'

type ViewerOverlayCallbacks = {
  onFileSelected?: (file: File) => void
  onRequestPopout?: () => void
  onRequestClosePopout?: () => void
  onRequestFullscreenToggle?: () => void
}

export type ViewerOverlayHandle = {
  setStatus: (message: string) => void
  setViewMode: (mode: TerrainViewMode) => void
  destroy: () => void
}

function ensureStyles(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = OVERLAY_CSS
  doc.head.appendChild(style)
}

export function createViewerOverlay(
  target: HTMLElement,
  callbacks: ViewerOverlayCallbacks = {}
): ViewerOverlayHandle {
  if (typeof window === 'undefined') {
    return {
      setStatus: () => {},
      setViewMode: () => {},
      destroy: () => {}
    }
  }
  const doc = target.ownerDocument
  ensureStyles(doc)
  target.classList.add('ctw-viewer-host')

  const overlay = doc.createElement('div')
  overlay.className = 'ctw-viewer-overlay'
  target.appendChild(overlay)

  const topRow = doc.createElement('div')
  topRow.className = 'ctw-viewer-overlay__top'
  const statusLabel = doc.createElement('div')
  statusLabel.className = 'ctw-viewer-overlay__status'
  statusLabel.textContent = 'Loading…'

  const buttonGroup = doc.createElement('div')
  buttonGroup.className = 'ctw-viewer-overlay__buttons'

  const loadBtn = doc.createElement('button')
  loadBtn.type = 'button'
  loadBtn.className = 'ctw-chip-button'
  loadBtn.textContent = 'Load Map'

  const modeBtn = doc.createElement('button')
  modeBtn.type = 'button'
  modeBtn.className = 'ctw-chip-button'

  const fullscreenBtn = doc.createElement('button')
  fullscreenBtn.type = 'button'
  fullscreenBtn.className = 'ctw-chip-button'
  fullscreenBtn.textContent = 'Full Screen'

  buttonGroup.append(loadBtn, modeBtn, fullscreenBtn)
  topRow.append(statusLabel, buttonGroup)
  overlay.append(topRow)

  const dropOverlay = doc.createElement('div')
  dropOverlay.className = 'ctw-drop-overlay'
  dropOverlay.textContent = 'Drop .wyn to load'
  target.appendChild(dropOverlay)

  const fileInput = doc.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.wyn'
  fileInput.style.display = 'none'
  target.appendChild(fileInput)

  function handleFiles(files: FileList | null) {
    const file = files?.item(0)
    if (!file) return
    callbacks.onFileSelected?.(file)
  }

  loadBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files)
    fileInput.value = ''
  })

  modeBtn.addEventListener('click', () => {
    if (currentMode === 'embed') {
      callbacks.onRequestPopout?.()
    } else {
      callbacks.onRequestClosePopout?.()
    }
  })

  fullscreenBtn.addEventListener('click', () => {
    callbacks.onRequestFullscreenToggle?.()
  })

  function prevent(event: Event) {
    event.preventDefault()
    event.stopPropagation()
  }

  function highlight() {
    target.classList.add('ctw-viewer-host--dragging')
  }
  function unhighlight() {
    target.classList.remove('ctw-viewer-host--dragging')
  }

  const dragEnter = (event: DragEvent) => {
    prevent(event)
    highlight()
  }
  const dragOver = (event: DragEvent) => {
    prevent(event)
    highlight()
  }
  const dragLeave = (event: DragEvent) => {
    prevent(event)
    const related = event.relatedTarget as HTMLElement | null
    if (!related || !target.contains(related)) {
      unhighlight()
    }
  }
  const drop = (event: DragEvent) => {
    prevent(event)
    unhighlight()
    handleFiles(event.dataTransfer?.files ?? null)
  }

  target.addEventListener('dragenter', dragEnter)
  target.addEventListener('dragover', dragOver)
  target.addEventListener('dragleave', dragLeave)
  target.addEventListener('drop', drop)

  let currentMode: TerrainViewMode = 'embed'
  function applyMode(mode: TerrainViewMode) {
    currentMode = mode
    if (mode === 'embed') {
      modeBtn.textContent = 'Pop Out'
      modeBtn.disabled = false
      fullscreenBtn.hidden = true
    } else if (mode === 'popout') {
      modeBtn.textContent = 'Close'
      modeBtn.disabled = false
      fullscreenBtn.hidden = false
      fullscreenBtn.textContent = 'Full Screen'
    } else {
      modeBtn.textContent = 'Close'
      modeBtn.disabled = false
      fullscreenBtn.hidden = false
      fullscreenBtn.textContent = 'Exit Full Screen'
    }
  }
  applyMode('embed')

  return {
    setStatus(message: string) {
      statusLabel.textContent = message
    },
    setViewMode(mode: TerrainViewMode) {
      applyMode(mode)
    },
    destroy() {
      target.removeEventListener('dragenter', dragEnter)
      target.removeEventListener('dragover', dragOver)
      target.removeEventListener('dragleave', dragLeave)
      target.removeEventListener('drop', drop)
      overlay.remove()
      fileInput.remove()
      dropOverlay.remove()
      target.classList.remove('ctw-viewer-host', 'ctw-viewer-host--dragging')
    }
  }
}
