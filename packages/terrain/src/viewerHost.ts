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

const noopHandle: TerrainViewerHostHandle = {
  openPopout: () => {},
  closePopout: () => {},
  toggleFullscreen: () => Promise.resolve(),
  getMode: () => 'embed',
  destroy: () => {}
}

export function createTerrainViewerHost(options: TerrainViewerHostOptions): TerrainViewerHostHandle {
  if (typeof window === 'undefined') return noopHandle
  const { viewerElement, embedTarget, title = 'Terrain Viewer', subtitle = 'Pop-out mode' } = options
  const doc = options.documentRoot ?? document
  if (!viewerElement || !embedTarget) return noopHandle

  let mode: TerrainViewMode = 'embed'
  let popoutOpen = false

  const overlay = doc.createElement('div')
  overlay.className = 'viewer-popout'
  overlay.setAttribute('aria-hidden', 'true')

  const chrome = doc.createElement('div')
  chrome.className = 'viewer-popout__chrome'
  overlay.appendChild(chrome)

  const header = doc.createElement('header')
  header.className = 'viewer-popout__header'
  chrome.appendChild(header)

  const headerText = doc.createElement('div')
  const label = doc.createElement('p')
  label.className = 'label'
  label.textContent = title
  const hint = doc.createElement('p')
  hint.className = 'hint'
  hint.textContent = subtitle
  headerText.append(label, hint)
  header.appendChild(headerText)

  const actionContainer = doc.createElement('div')
  actionContainer.className = 'viewer-popout__actions'
  const fullscreenBtn = doc.createElement('button')
  fullscreenBtn.className = 'chip-button'
  fullscreenBtn.type = 'button'
  fullscreenBtn.textContent = 'Enter Full Screen'
  const closeBtn = doc.createElement('button')
  closeBtn.className = 'chip-button'
  closeBtn.type = 'button'
  closeBtn.textContent = 'Return to Embed'
  actionContainer.append(fullscreenBtn, closeBtn)
  header.appendChild(actionContainer)

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
    updateFullscreenLabel()
  }

  function updateFullscreenLabel() {
    const inFullscreen = doc.fullscreenElement === overlay
    fullscreenBtn.textContent = inFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'
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
    updateFullscreenLabel()
  }

  overlay.addEventListener('click', handleOverlayClick)
  closeBtn.addEventListener('click', closePopout)
  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen().catch((error) => console.warn('Fullscreen request failed', error))
  })
  doc.addEventListener('fullscreenchange', handleFullscreenChange)

  updateFullscreenLabel()
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
