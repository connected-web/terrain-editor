<template>
  <div class="layer-mask-editor" ref="editorRootRef">
    <div
      class="layer-mask-editor__viewport"
      :class="viewportClasses"
      ref="viewportRef"
      @pointerdown="handleViewportPointerDown"
      @pointermove="handleViewportPointerMove"
      @pointerup="handleViewportPointerUp"
      @pointerleave="handleViewportPointerLeave"
      @pointerenter="handleViewportPointerEnter"
      @wheel="handleViewportWheel"
      @scroll.passive="handleViewportScroll"
    >
      <div
        v-show="hasValidImage"
        class="layer-mask-editor__canvas-wrapper"
        :style="canvasWrapperStyle"
      >
        <div class="layer-mask-editor__canvas-surface" :style="canvasSurfaceStyle">
          <canvas
            ref="canvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--base"
            draggable="false"
            @dragstart.prevent
            @mousedown="handlePointerDown"
            @mousemove="handlePointerMove"
            @mouseup="handlePointerUp"
            @mouseleave="handlePointerUp"
          />
          <canvas
            ref="previewCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--preview"
            draggable="false"
          />
          <div
            v-for="layer in onionLayerEntries"
            :key="`onion-${layer.id}`"
            class="layer-mask-editor__onion"
            :style="getOnionStyle(layer)"
          />
          <canvas
            ref="overlayCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--overlay"
            :style="overlayCanvasStyle"
            draggable="false"
            @dragstart.prevent
          />
        </div>
      </div>
      <div v-if="!hasValidImage" class="layer-mask-editor__placeholder">
        <p>{{ props.src ? 'Loading mask image...' : 'No mask image available' }}</p>
      </div>
    </div>
    <LayerMaskCursor
      :visible="cursorState.visible && showCustomCursor"
      :x="cursorState.position.x"
      :y="cursorState.position.y"
      :brush-size="brushSize"
      :zoom="zoom"
      :mode="cursorMode"
      :icon="activeCursorIcon"
      :opacity="brushOpacity"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LayerMaskCursor from './LayerMaskCursor.vue'

type OnionLayerOverlay = { id: string; src: string | null; color: [number, number, number] }

const props = defineProps<{
  src: string | null
  showGrid?: boolean
  valueMode?: 'mask' | 'heightmap'
  onionLayers?: OnionLayerOverlay[]
  tool?: string
  brushSize?: number
  brushOpacity?: number
  brushSoftness?: number
  brushFlow?: number
  brushSpacing?: number
  flatLevel?: number
}>()

const emit = defineEmits<{
  (ev: 'update-mask', blob: Blob): void
  (ev: 'zoom-change', value: number): void
  (ev: 'cursor-move', coords: { x: number; y: number }): void
  (ev: 'history-change', payload: { canUndo: boolean; canRedo: boolean; undoSteps: number; redoSteps: number }): void
  (ev: 'ready'): void
  (ev: 'view-change', payload: ViewState): void
}>()

const editorRootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const maskValues = ref<Float32Array | null>(null)
const initialMaskValues = ref<Float32Array | null>(null)
const undoStack: Float32Array[] = []
const redoStack: Float32Array[] = []
const HISTORY_LIMIT = 25
const canUndo = ref(false)
const canRedo = ref(false)

const hasValidImage = computed(() => {
  return Boolean(props.src && maskValues.value && maskValues.value.length)
})

const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const brushSize = computed(() => Math.min(512, Math.max(1, props.brushSize ?? 32)))
const brushOpacity = computed(() => Math.min(1, Math.max(0.01, props.brushOpacity ?? 1)))
const brushSoftness = computed(() => Math.min(1, Math.max(0, props.brushSoftness ?? 0)))
const brushFlow = computed(() => Math.min(1, Math.max(0.05, props.brushFlow ?? 1)))
const brushSpacing = computed(() => Math.min(2, Math.max(0.2, props.brushSpacing ?? 1)))
const flatLevel = computed(() => Math.min(1, Math.max(0, props.flatLevel ?? 0.5)))
const toolMode = computed(() => props.tool ?? 'brush')
const panModeActive = computed(() => toolMode.value === 'hand' || toolMode.value === 'pan')
const currentStrokeMode = computed<'paint' | 'erase' | 'flat'>(() => {
  if (toolMode.value === 'erase') return 'erase'
  if (toolMode.value === 'flat' && props.valueMode === 'heightmap') return 'flat'
  return 'paint'
})
const cursorMode = computed<'paint' | 'erase' | 'pan'>(() => {
  if (panModeActive.value) return 'pan'
  return currentStrokeMode.value === 'erase' ? 'erase' : 'paint'
})

type ViewState = {
  zoom: number
  centerX: number
  centerY: number
}

function updateHistoryState() {
  canUndo.value = undoStack.length > 1
  canRedo.value = redoStack.length > 0
  emit('history-change', {
    canUndo: canUndo.value,
    canRedo: canRedo.value,
    undoSteps: Math.max(0, undoStack.length - 1),
    redoSteps: Math.max(0, redoStack.length)
  })
}

function snapshotValues(values = maskValues.value) {
  if (!values) return null
  return new Float32Array(values)
}

function seedHistory() {
  undoStack.length = 0
  redoStack.length = 0
  const snap = snapshotValues()
  if (snap) {
    undoStack.push(snap)
  }
  updateHistoryState()
}

function pushHistorySnapshot() {
  const snap = snapshotValues()
  if (!snap) return
  undoStack.push(snap)
  if (undoStack.length > HISTORY_LIMIT) {
    undoStack.shift()
  }
  redoStack.length = 0
  updateHistoryState()
}

function restoreFromSnapshot(snapshot: Float32Array | null) {
  if (!snapshot) return
  maskValues.value = new Float32Array(snapshot)
  renderMaskCanvas()
  renderPreviewCanvas()
  clearOverlay()
}

function undo() {
  if (undoStack.length <= 1) return
  const current = undoStack.pop()
  if (current) {
    redoStack.push(current)
  }
  const previous = undoStack[undoStack.length - 1] ?? null
  restoreFromSnapshot(previous)
  updateHistoryState()
}

function redo() {
  if (!redoStack.length) return
  const snapshot = redoStack.pop() ?? null
  if (!snapshot) return
  undoStack.push(new Float32Array(snapshot))
  restoreFromSnapshot(snapshot)
  updateHistoryState()
}

const activeCursorIcon = computed(() => {
  switch (toolMode.value) {
    case 'erase':
      return 'minus'
    case 'flat':
      return 'equals'
    case 'hand':
    case 'pan':
      return 'hand'
    default:
      return 'paint-brush'
  }
})
const zoom = ref(1)
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const canvasDimensions = ref<{ width: number; height: number }>({ width: 0, height: 0 })
const pendingRestoreState = ref<{ state: ViewState; emit: boolean } | null>(null)
let suppressViewStateEmits = true
let pendingPostRestoreHandle: number | null = null
let viewInitialized = false
let viewTrackingEnabled = false
let pendingResumeHandle: number | null = null
let userViewportActivated = false
const displaySize = computed(() => ({
  width: Math.max(0, canvasDimensions.value.width * zoom.value),
  height: Math.max(0, canvasDimensions.value.height * zoom.value)
}))
const viewportSize = ref({ width: 0, height: 0 })
const currentViewState = ref<ViewState>({ zoom: 1, centerX: 0.5, centerY: 0.5 })
const viewportPadding = computed(() => ({
  x: viewportSize.value.width / 2,
  y: viewportSize.value.height / 2
}))
const totalCanvasSize = computed(() => ({
  width: displaySize.value.width + viewportPadding.value.x * 2,
  height: displaySize.value.height + viewportPadding.value.y * 2
}))
const canvasWrapperStyle = computed(() => ({
  width: `${Math.max(1, totalCanvasSize.value.width)}px`,
  height: `${Math.max(1, totalCanvasSize.value.height)}px`
}))
const canvasSurfaceStyle = computed(() => ({
  width: `${Math.max(1, displaySize.value.width)}px`,
  height: `${Math.max(1, displaySize.value.height)}px`,
  margin: `${viewportPadding.value.y}px ${viewportPadding.value.x}px`
}))
const overlayCanvasStyle = computed(() => ({
  opacity: Math.min(1, Math.max(0.01, brushOpacity.value))
}))

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function getPaddingOffsets() {
  return {
    x: viewportPadding.value.x,
    y: viewportPadding.value.y
  }
}

function isViewportReady(target = viewportRef.value) {
  if (!target) return false
  return Boolean(
    canvasDimensions.value.width &&
    canvasDimensions.value.height &&
    target.clientWidth > 0 &&
    target.clientHeight > 0
  )
}

function emitViewStateChange(options?: { force?: boolean }) {
  const hasCanvas = canvasDimensions.value.width && canvasDimensions.value.height
  const state = getViewState()
  currentViewState.value = state
  if (!hasCanvas) return
  if (!options?.force && !isViewportReady()) return
  if (!options?.force && (suppressViewStateEmits || !viewInitialized || !viewTrackingEnabled || !userViewportActivated)) return
  emit('view-change', state)
}

function applyZoom(nextZoom: number, pivot?: { x: number; y: number }) {
  const viewport = viewportRef.value
  if (!viewport || !canvasDimensions.value.width || !canvasDimensions.value.height) {
    zoom.value = clampZoom(nextZoom)
    emit('zoom-change', zoom.value)
    return
  }
  const previousZoom = zoom.value
  const clamped = clampZoom(nextZoom)
  if (clamped === previousZoom) return
  const baseWidth = canvasDimensions.value.width
  const baseHeight = canvasDimensions.value.height
  const prevDisplayWidth = baseWidth * previousZoom
  const prevDisplayHeight = baseHeight * previousZoom
  const nextDisplayWidth = baseWidth * clamped
  const nextDisplayHeight = baseHeight * clamped
  const clientWidth = viewport.clientWidth
  const clientHeight = viewport.clientHeight
  const pivotX = pivot?.x ?? clientWidth / 2
  const pivotY = pivot?.y ?? clientHeight / 2
  const prevScrollLeft = viewport.scrollLeft
  const prevScrollTop = viewport.scrollTop
  const { x: paddingX, y: paddingY } = getPaddingOffsets()
  const prevOffsetX = prevScrollLeft + pivotX - paddingX
  const prevOffsetY = prevScrollTop + pivotY - paddingY
  const ratioX = prevDisplayWidth ? Math.min(1, Math.max(0, prevOffsetX / prevDisplayWidth)) : 0
  const ratioY = prevDisplayHeight ? Math.min(1, Math.max(0, prevOffsetY / prevDisplayHeight)) : 0
  zoom.value = clamped
  const nextScrollLeft = paddingX + ratioX * nextDisplayWidth - pivotX
  const nextScrollTop = paddingY + ratioY * nextDisplayHeight - pivotY
  viewport.scrollLeft = Math.max(0, nextScrollLeft)
  viewport.scrollTop = Math.max(0, nextScrollTop)
  emit('zoom-change', clamped)
  emitViewStateChange()
}

function adjustZoom(delta: number) {
  applyZoom(zoom.value + delta)
}

function getContext(target: 'main' | 'overlay' | 'preview' = 'main') {
  if (target === 'overlay') {
    const canvas = overlayCanvasRef.value
    return canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null
  }
  if (target === 'preview') {
    const canvas = previewCanvasRef.value
    return canvas ? canvas.getContext('2d') : null
  }
  const canvas = canvasRef.value
  if (!canvas) return null
  return canvas.getContext('2d', { willReadFrequently: true })
}

function loadImage () {
  const canvas = canvasRef.value
  if (!canvas) return
  const overlay = overlayCanvasRef.value
  const preview = previewCanvasRef.value
  viewInitialized = false
  suppressViewStateEmits = true
  suspendViewTracking()
  userViewportActivated = false

  function resetCanvases(width: number, height: number) {
    if (canvas != null) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = getContext()
    ctx?.clearRect(0, 0, width, height)
    if (overlay) {
      overlay.width = width
      overlay.height = height
      getContext('overlay')?.clearRect(0, 0, width, height)
    }
    if (preview) {
      preview.width = width
      preview.height = height
      getContext('preview')?.clearRect(0, 0, width, height)
    }
  }

  if (!props.src) {
    resetCanvases(1, 1)
    maskValues.value = new Float32Array(1)
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
    seedHistory()
    emit('ready')
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = props.src

  img.onload = () => {
    resetCanvases(img.width, img.height)
    const ctx = getContext()
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const values = new Float32Array(img.width * img.height)
    for (let i = 0; i < values.length; i++) {
      values[i] = imageData.data[i * 4] / 255
    }
    maskValues.value = values
    initialMaskValues.value = new Float32Array(values)
    canvasDimensions.value = { width: img.width, height: img.height }
    image.value = img
    renderMaskCanvas()
    renderPreviewCanvas()
    seedHistory()
    emit('ready')
  }

  img.onerror = () => {
    resetCanvases(1, 1)
    maskValues.value = new Float32Array(1)
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
    emit('ready')
  }
}

function renderMaskCanvas() {
  const ctx = getContext()
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!ctx || !values || !width || !height) return
  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(1, values[i])) * 255
    const offset = i * 4
    imageData.data[offset] = v
    imageData.data[offset + 1] = v
    imageData.data[offset + 2] = v
    imageData.data[offset + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

function renderPreviewCanvas() {
  const ctx = getContext('preview')
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!ctx || !values || !width || !height) return
  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(1, values[i])) * 255
    const offset = i * 4
    imageData.data[offset] = 255
    imageData.data[offset + 1] = 255
    imageData.data[offset + 2] = 255
    imageData.data[offset + 3] = v
  }
  ctx.putImageData(imageData, 0, 0)
}

function canvasCoordsFromEvent(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

function clearOverlay() {
  const ctx = getContext('overlay')
  const overlay = overlayCanvasRef.value
  if (ctx && overlay) {
    ctx.clearRect(0, 0, overlay.width, overlay.height)
  }
}

function stampBrush(x: number, y: number) {
  const ctx = getContext('overlay')
  const overlay = overlayCanvasRef.value
  if (!ctx || !overlay) return
  const radius = brushSize.value / 2
  if (radius <= 0) return
  const softness = brushSoftness.value
  const hardness = Math.max(0, 1 - softness)
  const innerRadius = Math.max(0, radius * hardness)
  const tint =
    currentStrokeMode.value === 'erase'
      ? '255,64,64'
      : currentStrokeMode.value === 'flat'
        ? '64,200,255'
        : '255,255,255'
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, radius)
  gradient.addColorStop(0, `rgba(${tint},1)`)
  gradient.addColorStop(1, `rgba(${tint},0)`)
  ctx.fillStyle = gradient
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = brushFlow.value
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawStroke(fromX: number, fromY: number, toX: number, toY: number) {
  const spacingStep = Math.max(1, (brushSize.value / 4) * brushSpacing.value)
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(toX - fromX, toY - fromY) / spacingStep)
  )
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps
    const x = fromX + (toX - fromX) * t
    const y = fromY + (toY - fromY) * t
    stampBrush(x, y)
  }
}

function handlePointerDown(event: MouseEvent) {
  if (panModeActive.value || event.button !== 0) return
  markUserViewportInteraction()
  const { x, y } = canvasCoordsFromEvent(event)
  isDrawing.value = true
  lastX.value = x
  lastY.value = y
  clearOverlay()
  stampBrush(x, y)
}

function handlePointerMove(event: MouseEvent) {
  if (panModeActive.value) return
  if (!isDrawing.value) return
  const { x, y } = canvasCoordsFromEvent(event)
  drawStroke(lastX.value, lastY.value, x, y)
  lastX.value = x
  lastY.value = y
}

function handlePointerUp() {
  if (!isDrawing.value) return
  isDrawing.value = false
  commitOverlay()
}

function commitOverlay() {
  const overlay = overlayCanvasRef.value
  if (!overlay) return
  const overlayCtx = getContext('overlay')
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!overlayCtx || !values || !width || !height) return
  const opacity = Math.min(1, Math.max(0.01, brushOpacity.value))
  const overlayData = overlayCtx.getImageData(0, 0, width, height)
  const data = overlayData.data
  const mode = currentStrokeMode.value
  for (let i = 0; i < data.length; i += 4) {
    const alpha = (data[i + 3] / 255) * opacity
    if (alpha <= 0) continue
    const idx = i / 4
    const current = values[idx]
    if (mode === 'erase') {
      values[idx] = Math.max(0, current - alpha * current)
    } else if (mode === 'flat') {
      const target = flatLevel.value
      values[idx] = current + (target - current) * alpha
    } else {
      values[idx] = Math.min(1, current + alpha * (1 - current))
    }
  }
  renderMaskCanvas()
  renderPreviewCanvas()
  clearOverlay()
  pushHistorySnapshot()
}
const viewportRef = ref<HTMLDivElement | null>(null)
const isPanning = ref(false)
const panState = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
let viewportObserver: ResizeObserver | null = null

watch(
  () => viewportRef.value,
  (next, prev) => {
    if (prev && viewportObserver) {
      viewportObserver.unobserve(prev)
    }
    if (next) {
      if (!viewportObserver && typeof ResizeObserver !== 'undefined') {
        viewportObserver = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect
          if (!rect) return
          viewportSize.value = {
            width: rect.width,
            height: rect.height
          }
        })
      }
      viewportObserver?.observe(next)
      viewportSize.value = {
        width: next.clientWidth,
        height: next.clientHeight
      }
    }
  },
  { immediate: true }
)

watch(
  viewportSize,
  () => {
    if (!canvasDimensions.value.width || !canvasDimensions.value.height) return
    if (pendingRestoreState.value) return
    if (!viewInitialized) return
    restoreViewState(currentViewState.value, { emit: false })
  }
)

onBeforeUnmount(() => {
  if (viewportObserver) {
    viewportObserver.disconnect()
    viewportObserver = null
  }
})

function handleViewportPointerDown(event: PointerEvent) {
  const viewport = viewportRef.value
  if (!viewport) return
  markUserViewportInteraction()
  if (!panModeActive.value) {
    updateCursorPosition(event)
    return
  }
  event.preventDefault()
  isPanning.value = true
  panState.value = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop
  }
  viewport.setPointerCapture(event.pointerId)
}

function handleViewportPointerMove(event: PointerEvent) {
  updateCursorPosition(event)
  if (!isPanning.value) return
  const viewport = viewportRef.value
  if (!viewport) return
  event.preventDefault()
  const dx = event.clientX - panState.value.x
  const dy = event.clientY - panState.value.y
  viewport.scrollLeft = panState.value.scrollLeft - dx
  viewport.scrollTop = panState.value.scrollTop - dy
  emitViewStateChange()
}

function handleViewportPointerUp(event: PointerEvent) {
  if (!isPanning.value) return
  const viewport = viewportRef.value
  if (!viewport) return
  isPanning.value = false
  viewport.releasePointerCapture(event.pointerId)
}

function handleViewportScroll() {
  emitViewStateChange()
}

function handleReset () {
  const values = initialMaskValues.value
  if (!values) return
  restoreFromSnapshot(values)
  pushHistorySnapshot()
}

function handleApply () {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.toBlob(blob => {
    if (blob) emit('update-mask', blob)
  }, 'image/png')
}

function exportMask(options?: { includeAlpha?: boolean }): Promise<Blob | null> {
  const target = options?.includeAlpha ? previewCanvasRef.value : canvasRef.value
  if (!target) return Promise.resolve(null)
  return new Promise((resolve) => {
    target.toBlob((blob) => resolve(blob ?? null), 'image/png')
  })
}

function handleViewportWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  markUserViewportInteraction()
  event.preventDefault()
  const viewport = viewportRef.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  const pivot = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  const direction = event.deltaY > 0 ? -0.1 : 0.1
  applyZoom(zoom.value + direction, pivot)
  updateCursorPosition(event)
}

function fitView() {
  const viewport = viewportRef.value
  const { width, height } = canvasDimensions.value
  if (!viewport || !width || !height) {
    zoom.value = 1
    emit('zoom-change', zoom.value)
    return
  }
  const availableWidth = Math.max(1, viewport.clientWidth)
  const availableHeight = Math.max(1, viewport.clientHeight)
  const scaleX = availableWidth / width
  const scaleY = availableHeight / height
  const target = clampZoom(Math.min(scaleX, scaleY))
  zoom.value = target
  const displayWidth = width * target
  const displayHeight = height * target
  const { x: paddingX, y: paddingY } = getPaddingOffsets()
  const centerLeft = paddingX + displayWidth / 2 - viewport.clientWidth / 2
  const centerTop = paddingY + displayHeight / 2 - viewport.clientHeight / 2
  viewport.scrollLeft = Math.max(0, centerLeft)
  viewport.scrollTop = Math.max(0, centerTop)
  emit('zoom-change', zoom.value)
  viewInitialized = true
  suppressViewStateEmits = false
  emitViewStateChange({ force: true })
}

function setZoom(value: number) {
  applyZoom(value)
}

function getViewState(): ViewState {
  const viewport = viewportRef.value
  const { width, height } = canvasDimensions.value
  if (!viewport || !width || !height) {
    return {
      zoom: zoom.value,
      centerX: currentViewState.value.centerX,
      centerY: currentViewState.value.centerY
    }
  }
  const { x: paddingX, y: paddingY } = getPaddingOffsets()
  const displayWidth = width * zoom.value
  const displayHeight = height * zoom.value
  const centerLeft = viewport.scrollLeft + viewport.clientWidth / 2 - paddingX
  const centerTop = viewport.scrollTop + viewport.clientHeight / 2 - paddingY
  return {
    zoom: zoom.value,
    centerX: displayWidth ? clamp01(centerLeft / displayWidth) : 0.5,
    centerY: displayHeight ? clamp01(centerTop / displayHeight) : 0.5
  }
}

function normalizeViewState(state: Partial<ViewState>): ViewState {
  return {
    zoom: typeof state.zoom === 'number' ? state.zoom : zoom.value,
    centerX: typeof state.centerX === 'number' ? clamp01(state.centerX) : currentViewState.value.centerX,
    centerY: typeof state.centerY === 'number' ? clamp01(state.centerY) : currentViewState.value.centerY
  }
}

function applyNormalizedViewState(target: ViewState, emitChange: boolean) {
  const viewport = viewportRef.value
  const { width, height } = canvasDimensions.value
  if (!viewport || !width || !height || viewport.clientWidth === 0 || viewport.clientHeight === 0) {
    pendingRestoreState.value = { state: target, emit: emitChange }
    return
  }
  suppressViewStateEmits = true
  const { x: paddingX, y: paddingY } = getPaddingOffsets()
  const displayWidth = width * zoom.value
  const displayHeight = height * zoom.value
  const targetLeft = paddingX + target.centerX * displayWidth - viewport.clientWidth / 2
  const targetTop = paddingY + target.centerY * displayHeight - viewport.clientHeight / 2
  viewport.scrollLeft = Math.max(0, targetLeft)
  viewport.scrollTop = Math.max(0, targetTop)
  if (!emitChange) {
    currentViewState.value = target
  }
  if (pendingPostRestoreHandle !== null) {
    cancelAnimationFrame(pendingPostRestoreHandle)
  }
  pendingPostRestoreHandle = requestAnimationFrame(() => {
    pendingPostRestoreHandle = null
    suppressViewStateEmits = false
    viewTrackingEnabled = emitChange ? viewTrackingEnabled : viewTrackingEnabled
    viewInitialized = true
    if (emitChange) {
      emitViewStateChange({ force: true })
    } else {
      currentViewState.value = target
    }
  })
}

function restoreViewState(state?: Partial<ViewState> | null, options: { emit?: boolean } = {}) {
  if (!state) {
    fitView()
    return
  }
  if (typeof state.zoom === 'number') {
    setZoom(state.zoom)
  }
  const normalized = normalizeViewState(state)
  applyNormalizedViewState(normalized, options.emit !== false)
}

watch(
  () => [canvasDimensions.value.width, canvasDimensions.value.height] as const,
  () => {
    tryApplyPendingViewState()
  }
)

watch(
  viewportRef,
  () => {
    tryApplyPendingViewState()
  }
)

function tryApplyPendingViewState() {
  const payload = pendingRestoreState.value
  if (!payload) return
  const viewport = viewportRef.value
  const { width, height } = canvasDimensions.value
  if (!viewport || !width || !height || viewport.clientWidth === 0 || viewport.clientHeight === 0) return
  pendingRestoreState.value = null
  applyNormalizedViewState(payload.state, payload.emit)
}

function suspendViewTracking() {
  if (pendingResumeHandle !== null) {
    cancelAnimationFrame(pendingResumeHandle)
    pendingResumeHandle = null
  }
  viewTrackingEnabled = false
  userViewportActivated = false
}

function resumeViewTracking() {
  if (viewTrackingEnabled) return
  if (pendingResumeHandle !== null) {
    cancelAnimationFrame(pendingResumeHandle)
  }
  pendingResumeHandle = requestAnimationFrame(() => {
    pendingResumeHandle = null
    viewTrackingEnabled = true
  })
}

function markUserViewportInteraction() {
  if (userViewportActivated) return
  if (!viewTrackingEnabled || !viewInitialized) return
  userViewportActivated = true
}

defineExpose({
  fitView,
  setZoom,
  resetMask: handleReset,
  applyMask: handleApply,
  exportMask,
  undo,
  redo,
  getViewState,
  restoreViewState,
  seedHistory,
  suspendViewTracking,
  resumeViewTracking
})

watch(
  () => [props.src, canvasRef.value] as const,
  () => loadImage(),
  { immediate: true }
)

const showCustomCursor = computed(() => hasValidImage.value && !panModeActive.value)
const viewportClasses = computed(() => ({
  'layer-mask-editor__viewport--draw': showCustomCursor.value,
  'layer-mask-editor__viewport--pan': panModeActive.value,
  'layer-mask-editor__viewport--grid': props.showGrid !== false
}))
const onionLayerEntries = computed(() => props.onionLayers ?? [])

const cursorState = ref({
  position: { x: 0, y: 0 },
  visible: false
})
const cursorInside = ref(false)

function updateCursorPosition(event: PointerEvent | MouseEvent) {
  const root = editorRootRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  cursorState.value.position = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  cursorState.value.visible = cursorInside.value && showCustomCursor.value
  const canvas = canvasRef.value
  if (!canvas) return
  const coords = canvasCoordsFromEvent(event as MouseEvent)
  emit('cursor-move', {
    x: Math.round(coords.x),
    y: Math.round(coords.y)
  })
}

function handleViewportPointerEnter(event: PointerEvent) {
  cursorInside.value = true
  updateCursorPosition(event)
}

function handleViewportPointerLeave(event: PointerEvent) {
  cursorInside.value = false
  cursorState.value.visible = false
  handleViewportPointerUp(event)
}

watch(showCustomCursor, (canShow) => {
  cursorState.value.visible = canShow && cursorInside.value
})

onBeforeUnmount(() => {
  if (image.value?.src) {
    URL.revokeObjectURL(image.value.src)
  }
})

function colorToRgba(color: [number, number, number], alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

function getOnionStyle(layer: OnionLayerOverlay) {
  if (!layer.src) {
    return { opacity: 0 }
  }
  const color = colorToRgba(layer.color, 0.5)
  return {
    opacity: 0.5,
    backgroundColor: color,
    backgroundImage: `url(${layer.src})`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat'
  }
}
</script>

<style scoped>
.layer-mask-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  position: relative;
}

.layer-mask-editor__viewport {
  flex: 1;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background-color: #000;
  padding: 0.5rem;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.layer-mask-editor__viewport--grid {
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.04) 0 12px, transparent 12px 24px),
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 0 12px, transparent 12px 24px);
}

.layer-mask-editor__viewport--draw {
  cursor: none;
}

.layer-mask-editor__viewport--pan {
  cursor: grab;
}

.layer-mask-editor__viewport--pan:active {
  cursor: grabbing;
}

.layer-mask-editor__canvas-wrapper {
  position: relative;
  margin: 0 auto;
}

.layer-mask-editor__canvas-surface {
  position: relative;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 0.25rem;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.35);
  background: rgba(0, 0, 0, 0.8);
  min-width: 1px;
  min-height: 1px;
}

.layer-mask-editor__canvas {
  image-rendering: pixelated;
  background: transparent;
  display: block;
  width: 100%;
  height: 100%;
}

.layer-mask-editor__canvas--base {
  opacity: 0;
}

.layer-mask-editor__canvas--luminance {
  mix-blend-mode: lighten;
}

.layer-mask-editor__canvas--overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.layer-mask-editor__canvas--preview {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  mix-blend-mode: normal;
}

.layer-mask-editor__onion {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.layer-mask-editor__cursor {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.layer-mask-editor__cursor-brush {
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.8);
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.layer-mask-editor__cursor--erase .layer-mask-editor__cursor-brush {
  border-style: dashed;
}

.layer-mask-editor__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  text-align: center;
  pointer-events: none;
}

.layer-mask-editor__placeholder p {
  margin: 0;
}
</style>
