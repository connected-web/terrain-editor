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
  font-family: 'Inter', system-ui, sans-serif;
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

.ctw-viewer-overlay__bottom {
  display: flex;
  justify-content: flex-end;
}

.ctw-chip-button,
.ctw-interaction-toggle {
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

.ctw-chip-button:not(:disabled):hover,
.ctw-interaction-toggle:hover {
  border-color: rgba(223, 195, 135, 0.85);
}

.ctw-interaction-toggle {
  background: linear-gradient(135deg, #dfc387, #c07d4c);
  color: #05070d;
  border: none;
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

type ViewerOverlayCallbacks = {
  onFileSelected?: (file: File) => void
  onToggleInteraction?: () => void
  onRequestPopout?: () => void
  onRequestFullscreen?: () => void
}

export type ViewerOverlayHandle = {
  setStatus: (message: string) => void
  setInteractionActive: (active: boolean) => void
  setPopoutEnabled: (enabled: boolean) => void
  setFullscreenActive: (active: boolean) => void
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
      setInteractionActive: () => {},
      setPopoutEnabled: () => {},
      setFullscreenActive: () => {},
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
  loadBtn.textContent = 'Load .wyn'

  const popoutBtn = doc.createElement('button')
  popoutBtn.type = 'button'
  popoutBtn.className = 'ctw-chip-button'
  popoutBtn.textContent = 'Pop Out'

  const fullscreenBtn = doc.createElement('button')
  fullscreenBtn.type = 'button'
  fullscreenBtn.className = 'ctw-chip-button'
  fullscreenBtn.textContent = 'Full Screen'

  buttonGroup.append(loadBtn, popoutBtn, fullscreenBtn)
  topRow.append(statusLabel, buttonGroup)

  const bottomRow = doc.createElement('div')
  bottomRow.className = 'ctw-viewer-overlay__bottom'
  const interactionBtn = doc.createElement('button')
  interactionBtn.type = 'button'
  interactionBtn.className = 'ctw-interaction-toggle'
  interactionBtn.textContent = 'Enable Placement Mode'
  bottomRow.appendChild(interactionBtn)

  overlay.append(topRow, bottomRow)

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

  interactionBtn.addEventListener('click', () => {
    callbacks.onToggleInteraction?.()
  })

  popoutBtn.addEventListener('click', () => {
    callbacks.onRequestPopout?.()
  })

  fullscreenBtn.addEventListener('click', () => {
    callbacks.onRequestFullscreen?.()
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

  return {
    setStatus(message: string) {
      statusLabel.textContent = message
    },
    setInteractionActive(active: boolean) {
      interactionBtn.textContent = active ? 'Disable Placement Mode' : 'Enable Placement Mode'
    },
    setPopoutEnabled(enabled: boolean) {
      popoutBtn.disabled = !enabled
    },
    setFullscreenActive(active: boolean) {
      fullscreenBtn.textContent = active ? 'Exit Full Screen' : 'Full Screen'
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
