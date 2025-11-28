const STYLE_ID = 'ctw-viewer-overlay-styles'
const PROGRESS_VISIBILITY_DELAY_MS = 500
const PROGRESS_FADE_IN_DURATION_MS = 200
const PROGRESS_FADE_OUT_DURATION_MS = 500
const PROGRESS_CLEAR_DELAY_MS = PROGRESS_FADE_OUT_DURATION_MS
const PROGRESS_FADE_DURATION_VAR = '--ctw-viewer-progress-fade-duration'

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

.ctw-viewer-overlay__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  column-gap: 0.75rem;
  row-gap: 0.5rem;
  align-items: center;
  width: 100%;
}

.ctw-viewer-overlay__row--bottom {
  margin-top: 0.5rem;
}

.ctw-viewer-overlay__slot {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  flex-wrap: wrap;
}

.ctw-viewer-overlay__slot--top-left,
.ctw-viewer-overlay__slot--top-right,
.ctw-viewer-overlay__slot--top-center,
.ctw-viewer-overlay__slot--bottom-left,
.ctw-viewer-overlay__slot--bottom-right,
.ctw-viewer-overlay__slot--bottom-center {
  justify-content: flex-start;
  justify-self: flex-start;
}

.ctw-viewer-overlay__slot--top-right,
.ctw-viewer-overlay__slot--bottom-right {
  justify-content: flex-end;
  justify-self: flex-end;
}

.ctw-viewer-overlay__slot--top-center,
.ctw-viewer-overlay__slot--bottom-center {
  justify-content: center;
  justify-self: center;
  text-align: center;
}

.ctw-viewer-overlay__center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  pointer-events: none;
}

.ctw-viewer-overlay__center > * {
  pointer-events: auto;
}

.ctw-viewer-overlay__progress {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.75rem;
  background: rgba(5, 7, 13, 0.85);
  border: 1px solid rgba(223, 195, 135, 0.5);
  border-radius: 12px;
  padding: 0.65rem 0.85rem 0.8rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(${PROGRESS_FADE_DURATION_VAR}, 0.1s) ease;
}

.ctw-viewer-overlay__progress--visible {
  opacity: 1;
}

.ctw-viewer-overlay__progress-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(246, 231, 195, 0.9);
  margin-bottom: 0.2rem;
}

.ctw-viewer-overlay__progress-value {
  font-size: 0.78rem;
  color: rgba(246, 231, 195, 0.75);
  margin-bottom: 0.45rem;
}

.ctw-viewer-overlay__progress-bar {
  position: relative;
  height: 0.4rem;
  border-radius: 999px;
  background: rgba(246, 231, 195, 0.22);
  overflow: hidden;
}

.ctw-viewer-overlay__progress-fill {
  position: absolute;
  inset: 0;
  width: 0%;
  background: linear-gradient(90deg, #f6e7c3 0%, #d7c289 100%);
  border-radius: inherit;
  transition: width 0.2s ease;
}

.ctw-viewer-overlay__progress-bar--indeterminate .ctw-viewer-overlay__progress-fill {
  width: 40%;
  animation: ctw-viewer-progress-indeterminate 0.9s linear infinite;
}

@keyframes ctw-viewer-progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.ctw-viewer-overlay__status {
  font-size: 0.85rem;
  background: rgba(5, 7, 13, 0.6);
  border: 1px solid rgba(223, 195, 135, 0.5);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  backdrop-filter: blur(6px);
  line-height: 1.2rem;
  white-space: nowrap;
  overflow: hidden;
  max-width: max(150px, 50%, 30vw);
  text-overflow: ellipsis;
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.ctw-viewer-overlay__status--fade {
  opacity: 0;
  transform: translateY(-6px);
}

.ctw-viewer-overlay__buttons {
  display: flex;
  gap: 0.35rem;
}

.ctw-viewer-overlay__label {
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  color: rgba(246, 231, 195, 0.85);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: max(100px, 20vw);
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

type ViewerOverlayButtonLocation =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center'

export type ViewerOverlayCustomButton = {
  location: ViewerOverlayButtonLocation
  label: string
  description?: string
  callback?: () => void
}

type ViewerOverlayStatusOptions = {
  initialText: string
}

type ViewerOverlaySelectFileOptions = {
  enabled: boolean
  label: string
  callback?: (file: File) => void
}

type ViewerOverlayPopoutOptions = {
  enabled: boolean
  labelOpen: string
  labelClose: string
  onRequestOpen?: () => void
  onRequestClose?: () => void
}

type ViewerOverlayFullscreenOptions = {
  enabled: boolean
  labelEnter: string
  labelExit: string
  onToggle?: () => void
  displayInEmbed: boolean
}

type ResolvedViewerOverlayOptions = {
  status: ViewerOverlayStatusOptions
  selectFile: ViewerOverlaySelectFileOptions
  popout: ViewerOverlayPopoutOptions
  fullscreen: ViewerOverlayFullscreenOptions
  customButtons: ViewerOverlayCustomButton[]
}

export type ViewerOverlayOptions = {
  status?: Partial<ViewerOverlayStatusOptions>
  selectFile?: Partial<Omit<ViewerOverlaySelectFileOptions, 'enabled' | 'label'>> & {
    enabled?: boolean
    label?: string
  }
  popout?: Partial<Omit<ViewerOverlayPopoutOptions, 'enabled' | 'labelOpen' | 'labelClose'>> & {
    enabled?: boolean
    labelOpen?: string
    labelClose?: string
  }
  fullscreen?: Partial<Omit<ViewerOverlayFullscreenOptions, 'enabled' | 'labelEnter' | 'labelExit' | 'displayInEmbed'>> & {
    enabled?: boolean
    labelEnter?: string
    labelExit?: string
    displayInEmbed?: boolean
  }
  customButtons?: ViewerOverlayCustomButton[]
}

function resolveViewerOverlayOptions(options: ViewerOverlayOptions = {}): ResolvedViewerOverlayOptions {
  return {
    status: {
      initialText: options.status?.initialText ?? 'Loading…'
    },
    selectFile: {
      enabled: options.selectFile?.enabled ?? true,
      label: options.selectFile?.label ?? 'Load Map',
      callback: options.selectFile?.callback
    },
    popout: {
      enabled: options.popout?.enabled ?? true,
      labelOpen: options.popout?.labelOpen ?? 'Pop Out',
      labelClose: options.popout?.labelClose ?? 'Close',
      onRequestOpen: options.popout?.onRequestOpen,
      onRequestClose: options.popout?.onRequestClose
    },
    fullscreen: {
      enabled: options.fullscreen?.enabled ?? true,
      labelEnter: options.fullscreen?.labelEnter ?? 'Full Screen',
      labelExit: options.fullscreen?.labelExit ?? 'Exit Full Screen',
      onToggle: options.fullscreen?.onToggle,
      displayInEmbed: options.fullscreen?.displayInEmbed ?? false
    },
    customButtons: options.customButtons ?? []
  }
}

export type ViewerOverlayLoadingState = {
  label: string
  loadedBytes: number
  totalBytes?: number
}

export type ViewerOverlayHandle = {
  setStatus: (message: string) => void
  setStatusFade: (fade: boolean) => void
  setViewMode: (mode: TerrainViewMode) => void
  setLoadingProgress: (state: ViewerOverlayLoadingState | null) => void
  hideDropOverlay: () => void
  openFileDialog?: () => void
  destroy: () => void
}

function formatBytes(bytes: number) {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1)
  return `${rounded} ${units[exponent]}`
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
  optionsInput: ViewerOverlayOptions = {}
): ViewerOverlayHandle {
  if (typeof window === 'undefined') {
    return {
      setStatus: () => {},
      setStatusFade: () => {},
      setViewMode: () => {},
      setLoadingProgress: () => {},
      hideDropOverlay: () => {},
      openFileDialog: () => {},
      destroy: () => {}
    }
  }
  const options = resolveViewerOverlayOptions(optionsInput)
  const doc = target.ownerDocument
  ensureStyles(doc)
  target.classList.add('ctw-viewer-host')

  const overlay = doc.createElement('div')
  overlay.className = 'ctw-viewer-overlay'
  target.appendChild(overlay)

  const createSlot = (position: ViewerOverlayButtonLocation) => {
    const slot = doc.createElement('div')
    slot.className = `ctw-viewer-overlay__slot ctw-viewer-overlay__slot--${position}`
    return slot
  }

  const topRow = doc.createElement('div')
  topRow.className = 'ctw-viewer-overlay__row ctw-viewer-overlay__row--top'
  const topLeftSlot = createSlot('top-left')
  const topCenterSlot = createSlot('top-center')
  const topRightSlot = createSlot('top-right')
  topRow.append(topLeftSlot, topCenterSlot, topRightSlot)
  overlay.append(topRow)

  const bottomRow = doc.createElement('div')
  bottomRow.className = 'ctw-viewer-overlay__row ctw-viewer-overlay__row--bottom'
  const bottomLeftSlot = createSlot('bottom-left')
  const bottomCenterSlot = createSlot('bottom-center')
  const bottomRightSlot = createSlot('bottom-right')
  bottomRow.append(bottomLeftSlot, bottomCenterSlot, bottomRightSlot)
  const bottomLocations = new Set<ViewerOverlayButtonLocation>([
    'bottom-left',
    'bottom-center',
    'bottom-right'
  ])
  let bottomRowMounted = false

  const centerSlot = doc.createElement('div')
  centerSlot.className = 'ctw-viewer-overlay__center'
  let centerSlotMounted = false

  const progressPanel = doc.createElement('div')
  progressPanel.className = 'ctw-viewer-overlay__progress'
  const progressLabel = doc.createElement('div')
  progressLabel.className = 'ctw-viewer-overlay__progress-label'
  const progressValue = doc.createElement('div')
  progressValue.className = 'ctw-viewer-overlay__progress-value'
  const progressBar = doc.createElement('div')
  progressBar.className = 'ctw-viewer-overlay__progress-bar'
  const progressFill = doc.createElement('div')
  progressFill.className = 'ctw-viewer-overlay__progress-fill'
  progressBar.append(progressFill)
  progressPanel.append(progressLabel, progressValue, progressBar)
  overlay.append(progressPanel)

  const slotMap: Record<Exclude<ViewerOverlayButtonLocation, 'center'>, HTMLDivElement> = {
    'top-left': topLeftSlot,
    'top-center': topCenterSlot,
    'top-right': topRightSlot,
    'bottom-left': bottomLeftSlot,
    'bottom-center': bottomCenterSlot,
    'bottom-right': bottomRightSlot
  }

  function appendToSlot(location: ViewerOverlayButtonLocation, element: HTMLElement) {
    if (location === 'center') {
      if (!centerSlotMounted) {
        overlay.append(centerSlot)
        centerSlotMounted = true
      }
      centerSlot.appendChild(element)
      return
    }
    if (bottomLocations.has(location) && !bottomRowMounted) {
      overlay.insertBefore(bottomRow, progressPanel)
      bottomRowMounted = true
    }
    slotMap[location].appendChild(element)
  }

  const statusLabel = doc.createElement('div')
  statusLabel.className = 'ctw-viewer-overlay__status'
  statusLabel.textContent = options.status.initialText
  appendToSlot('top-left', statusLabel)
  function setStatusFade(fade: boolean) {
    statusLabel.classList.toggle('ctw-viewer-overlay__status--fade', fade)
  }

  const buttonGroup = doc.createElement('div')
  buttonGroup.className = 'ctw-viewer-overlay__buttons'
  appendToSlot('top-right', buttonGroup)

  let fileInput: HTMLInputElement | null = null
  let openFileDialogImpl: () => void = () => {}
  let dropOverlay: HTMLDivElement | null = null
  let dragEnter: ((event: DragEvent) => void) | null = null
  let dragOver: ((event: DragEvent) => void) | null = null
  let dragLeave: ((event: DragEvent) => void) | null = null
  let drop: ((event: DragEvent) => void) | null = null
  let loadBtn: HTMLButtonElement | null = null

  if (options.selectFile.enabled) {
    loadBtn = doc.createElement('button')
    loadBtn.type = 'button'
    loadBtn.className = 'ctw-chip-button'
    loadBtn.textContent = options.selectFile.label
    const canHandleFiles = Boolean(options.selectFile.callback)
    loadBtn.disabled = !canHandleFiles
    buttonGroup.appendChild(loadBtn)

    if (canHandleFiles) {
      fileInput = doc.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.wyn'
      fileInput.style.display = 'none'
      target.appendChild(fileInput)

      let handleFiles = (files: FileList | null) => {
        const file = files?.item(0)
        if (!file) return
        options.selectFile.callback?.(file)
      }

      const openDialog = () => fileInput?.click()
      openFileDialogImpl = openDialog
      loadBtn.addEventListener('click', openDialog)
      fileInput.addEventListener('change', () => {
        void handleFiles(fileInput?.files ?? null)
        if (fileInput) {
          fileInput.value = ''
        }
      })

      dropOverlay = doc.createElement('div')
      dropOverlay.className = 'ctw-drop-overlay'
      dropOverlay.textContent = 'Drop .wyn to load'
      dropOverlay.style.display = 'none'
      target.appendChild(dropOverlay)

      const prevent = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
      }

      const showOverlay = () => {
        if (dropOverlay) dropOverlay.style.display = 'flex'
      }
      const hideOverlay = () => {
        if (dropOverlay) dropOverlay.style.display = 'none'
      }
      const highlight = () => {
        target.classList.add('ctw-viewer-host--dragging')
        showOverlay()
      }
      const unhighlight = () => {
        target.classList.remove('ctw-viewer-host--dragging')
        hideOverlay()
      }

      handleFiles = async (files: FileList | null) => {
        const file = files?.item(0)
        if (!file) {
          unhighlight()
          return
        }
        try {
          await Promise.resolve(options.selectFile.callback?.(file))
        } finally {
          unhighlight()
        }
      }

      dragEnter = (event: DragEvent) => {
        prevent(event)
        highlight()
      }
      dragOver = (event: DragEvent) => {
        prevent(event)
        highlight()
      }
      dragLeave = (event: DragEvent) => {
        prevent(event)
        const related = event.relatedTarget as HTMLElement | null
        if (!related || !target.contains(related)) {
          unhighlight()
        }
      }
      drop = (event: DragEvent) => {
        prevent(event)
        unhighlight()
        void handleFiles(event.dataTransfer?.files ?? null)
      }

      target.addEventListener('dragenter', dragEnter)
      target.addEventListener('dragover', dragOver)
      target.addEventListener('dragleave', dragLeave)
      target.addEventListener('drop', drop)
    }
  }

  let modeBtn: HTMLButtonElement | null = null
  if (options.popout.enabled) {
    modeBtn = doc.createElement('button')
    modeBtn.type = 'button'
    modeBtn.className = 'ctw-chip-button'
    modeBtn.textContent = options.popout.labelOpen
    buttonGroup.appendChild(modeBtn)
    modeBtn.addEventListener('click', () => {
      if (currentMode === 'embed') {
        options.popout.onRequestOpen?.()
      } else {
        options.popout.onRequestClose?.()
      }
    })
  }

  let fullscreenBtn: HTMLButtonElement | null = null
  if (options.fullscreen.enabled) {
    fullscreenBtn = doc.createElement('button')
    fullscreenBtn.type = 'button'
    fullscreenBtn.className = 'ctw-chip-button'
    fullscreenBtn.textContent = options.fullscreen.labelEnter
    buttonGroup.appendChild(fullscreenBtn)
    fullscreenBtn.addEventListener('click', () => {
      options.fullscreen.onToggle?.()
    })
  }

  if (!buttonGroup.childElementCount) {
    buttonGroup.remove()
  }

  options.customButtons.forEach((custom) => {
    if (custom.callback) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.className = 'ctw-chip-button'
      button.textContent = custom.label
      if (custom.description) {
        button.title = custom.description
      }
      button.addEventListener('click', () => custom.callback?.())
      appendToSlot(custom.location, button)
    } else {
      const label = doc.createElement('span')
      label.className = 'ctw-viewer-overlay__label'
      label.textContent = custom.label
      appendToSlot(custom.location, label)
    }
  })

  let currentMode: TerrainViewMode = 'embed'
  let currentLoading: ViewerOverlayLoadingState | null = null
  let progressVisible = false
  let progressTimer: number | null = null
  let progressClearTimer: number | null = null

  function resetProgressContent() {
    progressLabel.textContent = ''
    progressValue.textContent = ''
    progressFill.style.width = '0%'
    progressBar.classList.remove('ctw-viewer-overlay__progress-bar--indeterminate')
  }

  function cancelProgressContentReset() {
    if (progressClearTimer) {
      window.clearTimeout(progressClearTimer)
      progressClearTimer = null
    }
  }

  function scheduleProgressContentReset() {
    cancelProgressContentReset()
    progressClearTimer = window.setTimeout(() => {
      resetProgressContent()
      progressClearTimer = null
    }, PROGRESS_CLEAR_DELAY_MS)
  }
  function setProgressFadeDuration(durationMs: number) {
    progressPanel.style.setProperty(PROGRESS_FADE_DURATION_VAR, `${durationMs}ms`)
  }
  function showProgressPanel() {
    if (progressVisible) return
    setProgressFadeDuration(PROGRESS_FADE_IN_DURATION_MS)
    progressPanel.classList.add('ctw-viewer-overlay__progress--visible')
    progressVisible = true
  }
  function hideProgressPanel() {
    if (progressTimer) {
      window.clearTimeout(progressTimer)
      progressTimer = null
    }
    setProgressFadeDuration(PROGRESS_FADE_OUT_DURATION_MS)
    progressPanel.classList.remove('ctw-viewer-overlay__progress--visible')
    progressVisible = false
  }

  function updateProgressPanel(state: ViewerOverlayLoadingState | null) {
    currentLoading = state
    if (!state) {
      hideProgressPanel()
      scheduleProgressContentReset()
      return
    }

    cancelProgressContentReset()
    progressLabel.textContent = state.label
    if (typeof state.totalBytes === 'number' && state.totalBytes > 0) {
      const percent = Math.min(state.loadedBytes / state.totalBytes, 1)
      const percentText = `${Math.round(percent * 100)}%`
      progressValue.textContent = `${percentText} — ${formatBytes(state.loadedBytes)} / ${formatBytes(state.totalBytes)}`
      progressFill.style.width = `${percent * 100}%`
      progressBar.classList.remove('ctw-viewer-overlay__progress-bar--indeterminate')
    } else {
      progressValue.textContent = `${formatBytes(state.loadedBytes)}`
      progressFill.style.width = '40%'
      progressBar.classList.add('ctw-viewer-overlay__progress-bar--indeterminate')
    }

    if (!progressVisible && !progressTimer) {
      progressTimer = window.setTimeout(() => {
        progressTimer = null
        if (!currentLoading) return
        showProgressPanel()
      }, PROGRESS_VISIBILITY_DELAY_MS)
    }
  }

  function applyMode(mode: TerrainViewMode) {
    currentMode = mode
    if (modeBtn) {
      modeBtn.disabled = false
      modeBtn.textContent = mode === 'embed' ? options.popout.labelOpen : options.popout.labelClose
    }
    if (fullscreenBtn) {
      const shouldShowFullscreen = options.fullscreen.displayInEmbed || mode !== 'embed'
      fullscreenBtn.hidden = !shouldShowFullscreen
      fullscreenBtn.textContent = mode === 'fullscreen' ? options.fullscreen.labelExit : options.fullscreen.labelEnter
    }
  }
  applyMode('embed')

  return {
    setStatus(message: string) {
      statusLabel.textContent = message
      setStatusFade(false)
    },
    setStatusFade,
    setViewMode(mode: TerrainViewMode) {
      applyMode(mode)
    },
    setLoadingProgress(state: ViewerOverlayLoadingState | null) {
      updateProgressPanel(state)
    },
    openFileDialog() {
      openFileDialogImpl()
    },
    destroy() {
      hideProgressPanel()
      cancelProgressContentReset()
      resetProgressContent()
      if (dragEnter) {
        target.removeEventListener('dragenter', dragEnter)
      }
      if (dragOver) {
        target.removeEventListener('dragover', dragOver)
      }
      if (dragLeave) {
        target.removeEventListener('dragleave', dragLeave)
      }
      if (drop) {
        target.removeEventListener('drop', drop)
      }
      overlay.remove()
      fileInput?.remove()
      dropOverlay?.remove()
      target.classList.remove('ctw-viewer-host', 'ctw-viewer-host--dragging')
    }
  }
}
