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
          />
          <canvas
            ref="previewCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--preview"
            draggable="false"
          />
          <canvas
            ref="gridCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--grid"
            :style="gridCanvasStyle"
            draggable="false"
            aria-hidden="true"
          />
          <canvas
            ref="colorCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--color"
            :style="colorCanvasStyle"
            draggable="false"
            aria-hidden="true"
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
          <canvas
            ref="selectionCanvasRef"
            class="layer-mask-editor__canvas layer-mask-editor__canvas--selection"
            draggable="false"
            aria-hidden="true"
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
      :show-brush-ring="!flatSampleActive && ['brush', 'erase', 'flat'].includes(toolMode)"
      :icon-anchor="['select', 'grid', 'hand', 'transform'].includes(toolMode) ? 'center' : 'offset'"
      :anchor="flatSampleActive && toolMode !== 'fill' ? 'bottom-left' : 'center'"
      :sample-value="cursorSampleValue"
      :show-target-dot="toolMode === 'fill'"
      :fixed-icon-offset="toolMode === 'fill' || flatSampleActive || toolMode === 'grid'"
      :brush-shape="brushShape"
      :brush-angle="brushAngleDegrees"
    />
    <div
      v-if="debugCursor && debugDotStyle"
      class="layer-mask-editor__debug-dot"
      :style="debugDotStyle"
    />
    <div
      v-if="fillPreviewPending || fillPreviewLoading"
      class="layer-mask-editor__fill-spinner"
      :class="{ 'layer-mask-editor__fill-spinner--loading': fillPreviewLoading }"
      :style="fillSpinnerStyle"
    >
      <div class="layer-mask-editor__spinner"></div>
    </div>
    <div v-if="selectionApplyBusy" class="layer-mask-editor__selection-working">
      <div class="layer-mask-editor__spinner"></div>
      <span>Applying selection…</span>
    </div>
    <div
      v-if="snapDotStyle && snapEnabled"
      class="layer-mask-editor__snap-dot"
      :style="snapDotStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LayerMaskCursor from './LayerMaskCursor.vue'

type OnionLayerOverlay = { id: string; src: string | null; color: [number, number, number] }
type SelectionRect = {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
}
type SelectionMask = {
  type: 'mask'
  width: number
  height: number
  mask: Uint8Array
}
type SelectionData = SelectionRect | SelectionMask

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
  brushShape?: 'round' | 'square' | 'triangle' | 'line'
  brushTexture?: 'none' | 'spray' | 'perlin'
  brushAngle?: number
  perlinScale?: number
  perlinDensity?: number
  perlinRotation?: number
  perlinSoftness?: number
  flatLevel?: number
  fillLevel?: number
  fillTolerance?: number
  flatSampleMode?: boolean
  viewMode?: 'grayscale' | 'color'
  maskColor?: [number, number, number] | null
  selection?: SelectionData | null
  selectionMode?: 'rect' | 'fill'
  gridEnabled?: boolean
  gridMode?: 'underlay' | 'overlay'
  gridOpacity?: number
  gridSize?: number
  gridColor?: string
  pasteMode?: 'replace' | 'merge'
  snapEnabled?: boolean
  snapSize?: number
  angleSnapEnabled?: boolean
}>()

const emit = defineEmits<{
  (ev: 'update-mask', blob: Blob): void
  (ev: 'zoom-change', value: number): void
  (ev: 'cursor-move', coords: { x: number; y: number }): void
  (ev: 'history-change', payload: { canUndo: boolean; canRedo: boolean; undoSteps: number; redoSteps: number }): void
  (ev: 'ready'): void
  (ev: 'view-change', payload: ViewState): void
  (ev: 'flat-sample', value: number): void
  (ev: 'selection-change', selection: SelectionData | null): void
  (ev: 'paste-applied'): void
}>()

const editorRootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const gridCanvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const selectionCanvasRef = ref<HTMLCanvasElement | null>(null)
const colorCanvasRef = ref<HTMLCanvasElement | null>(null)
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
const pendingAnchor = ref<{ x: number; y: number } | null>(null)
const strokeAnchor = ref<{ x: number; y: number } | null>(null)
const pasteBuffer = ref<{ width: number; height: number; values: Float32Array; mask: Uint8Array } | null>(null)
const pastePosition = ref<{ x: number; y: number } | null>(null)
const pasteDragOffset = ref<{ x: number; y: number } | null>(null)
const lastCanvasCoords = ref<{ x: number; y: number } | null>(null)
const lastStrokePoint = ref<{ x: number; y: number } | null>(null)
const selectionBounds = ref<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null)
const pasteFollowCursor = ref(false)
const pasteLocked = ref(false)
const pasteHover = ref(false)
const pointerTrackingActive = ref(false)
const brushSize = computed(() => Math.min(512, Math.max(1, props.brushSize ?? 32)))
const brushOpacity = computed(() => Math.min(1, Math.max(0.01, props.brushOpacity ?? 1)))
const brushSoftness = computed(() => Math.min(1, Math.max(0, props.brushSoftness ?? 0)))
const brushFlow = computed(() => Math.min(1, Math.max(0.05, props.brushFlow ?? 1)))
const brushSpacing = computed(() => Math.min(2, Math.max(0.2, props.brushSpacing ?? 1)))
const brushShape = computed(() => props.brushShape ?? 'round')
const brushTexture = computed(() => props.brushTexture ?? 'none')
const brushAngleDegrees = computed(() => props.brushAngle ?? 0)
const brushAngle = computed(() => (brushAngleDegrees.value * Math.PI) / 180)
const perlinScale = computed(() => Math.max(2, props.perlinScale ?? 12))
const perlinDensity = computed(() => Math.min(1, Math.max(0, props.perlinDensity ?? 0.7)))
const perlinRotation = computed(() => props.perlinRotation ?? 0)
const perlinSoftness = computed(() => Math.min(1, Math.max(0, props.perlinSoftness ?? 0.6)))
const selectionMode = computed(() => props.selectionMode ?? 'rect')
const selectionData = computed(() => props.selection ?? null)
const gridEnabled = computed(() => props.gridEnabled ?? false)
const gridMode = computed(() => props.gridMode ?? 'underlay')
const gridOpacity = computed(() => Math.min(1, Math.max(0, props.gridOpacity ?? 0.35)))
const gridSize = computed(() => Math.max(1, props.gridSize ?? 32))
const gridColor = computed(() => props.gridColor ?? '#ffffff')
const pasteMode = computed<'replace' | 'merge'>(() => props.pasteMode ?? 'replace')
const snapEnabled = computed(() => props.snapEnabled ?? false)
const snapSize = computed(() => Math.max(1, props.snapSize ?? 16))
const angleSnapEnabled = computed(() => props.angleSnapEnabled ?? false)
const snapGuide = ref<{ start: { x: number; y: number }; end: { x: number; y: number }; angle: number } | null>(null)
const flatLevel = computed(() => Math.min(1, Math.max(0, props.flatLevel ?? 0.5)))
const fillLevel = computed(() => Math.min(1, Math.max(0, props.fillLevel ?? flatLevel.value)))
const fillTolerance = computed(() => Math.min(1, Math.max(0, props.fillTolerance ?? 0.1)))
const toolMode = computed(() => props.tool ?? 'brush')
const panModeActive = computed(() => toolMode.value === 'hand' || toolMode.value === 'pan')
const flatSampleActive = computed(() => {
  if (!props.flatSampleMode) return false
  if (toolMode.value === 'flat') {
    return props.valueMode === 'heightmap'
  }
  return toolMode.value === 'fill'
})
const currentStrokeMode = computed<'paint' | 'erase' | 'flat'>(() => {
  if (toolMode.value === 'erase') return 'erase'
  if (toolMode.value === 'flat' && props.valueMode === 'heightmap') return 'flat'
  return 'paint'
})
const cursorMode = computed<'paint' | 'erase' | 'pan'>(() => {
  if (panModeActive.value) return 'pan'
  if (toolMode.value === 'grid') return 'paint'
  return currentStrokeMode.value === 'erase' ? 'erase' : 'paint'
})
const viewMode = computed(() => props.viewMode ?? 'grayscale')
const maskColor = computed<[number, number, number]>(() => props.maskColor ?? [255, 255, 255])
const showColorOverlay = computed(() =>
  viewMode.value === 'color' && props.valueMode !== 'heightmap' && Boolean(props.maskColor)
)
const colorCanvasStyle = computed(() => ({
  opacity: showColorOverlay.value ? '1' : '0'
}))

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
  if (flatSampleActive.value) {
    return 'eye-dropper'
  }
  switch (toolMode.value) {
    case 'grid':
      return 'border-all'
    case 'transform':
      return 'arrows-up-down-left-right'
    case 'select':
      return pasteHover.value ? 'arrows-up-down-left-right' : 'crosshairs'
    case 'fill':
      return 'fill-drip'
    case 'erase':
      return 'eraser'
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

function computeViewportPadding(width: number, height: number) {
  return {
    x: width / 2,
    y: height / 2
  }
}

const viewportPadding = computed(() => computeViewportPadding(viewportSize.value.width, viewportSize.value.height))
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
const gridCanvasStyle = computed(() => ({
  opacity: gridEnabled.value ? String(gridOpacity.value) : '0',
  zIndex: gridMode.value === 'overlay' ? 1 : 0
}))

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function getPaddingOffsets() {
  const viewport = viewportRef.value
  const width = viewportSize.value.width || viewport?.clientWidth || 0
  const height = viewportSize.value.height || viewport?.clientHeight || 0
  return computeViewportPadding(width, height)
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
    if (gridCanvasRef.value) {
      gridCanvasRef.value.width = width
      gridCanvasRef.value.height = height
      gridCanvasRef.value.getContext('2d')?.clearRect(0, 0, width, height)
    }
    if (selectionCanvasRef.value) {
      selectionCanvasRef.value.width = width
      selectionCanvasRef.value.height = height
      selectionCanvasRef.value.getContext('2d')?.clearRect(0, 0, width, height)
    }
  }

  if (!props.src) {
    resetCanvases(1, 1)
    maskValues.value = new Float32Array(1)
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
    seedHistory()
    renderGridOverlay()
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
    renderGridOverlay()
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
  renderColorPreviewCanvas()
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

function renderGridOverlay() {
  const canvas = gridCanvasRef.value
  const { width, height } = canvasDimensions.value
  if (!canvas || !width || !height) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  ctx.clearRect(0, 0, width, height)
  if (!gridEnabled.value) return
  const step = Math.max(1, Math.round(gridSize.value))
  ctx.strokeStyle = gridColor.value
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
  }
  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
  }
  ctx.stroke()
}

function renderColorPreviewCanvas() {
  const canvas = colorCanvasRef.value
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const ready = Boolean(values && width && height)
  if (canvas.width !== width) {
    canvas.width = width || 0
  }
  if (canvas.height !== height) {
    canvas.height = height || 0
  }
  if (!ready || !showColorOverlay.value || !props.maskColor) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }
  if (!values || !width || !height) return
  const imageData = ctx.createImageData(width, height)
  const [r, g, b] = maskColor.value
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(1, values[i]))
    const offset = i * 4
    imageData.data[offset] = r
    imageData.data[offset + 1] = g
    imageData.data[offset + 2] = b
    imageData.data[offset + 3] = Math.round(v * 255)
  }
  ctx.putImageData(imageData, 0, 0)
}

function clearSelectionOverlay() {
  const canvas = selectionCanvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function renderSelectionOverlay(
  selection: SelectionData | null,
  draft?: SelectionRect | null,
  draftMode?: 'replace' | 'add' | 'subtract'
) {
  const canvas = selectionCanvasRef.value
  const { width, height } = canvasDimensions.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !width || !height) return
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  ctx.clearRect(0, 0, width, height)
  if (!selection && !draft && !(snapGuide.value && angleSnapEnabled.value)) return

  if (selection?.type === 'rect') {
    if (selection.canvasWidth !== width || selection.canvasHeight !== height) return
    const x = Math.max(0, Math.min(width, selection.x))
    const y = Math.max(0, Math.min(height, selection.y))
    const w = Math.max(1, Math.min(width - x, selection.width))
    const h = Math.max(1, Math.min(height - y, selection.height))
    ctx.fillStyle = 'rgba(255, 215, 80, 0.12)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(255, 215, 80, 0.9)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2))
    ctx.setLineDash([])
  } else if (selection) {
    if (selection.width !== width || selection.height !== height) return
    if (!selectionOverlayCache.value || selectionOverlayCache.value.width !== width || selectionOverlayCache.value.height !== height) {
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data
      for (let i = 0; i < selection.mask.length; i += 1) {
        if (!selection.mask[i]) continue
        const idx = i * 4
        data[idx] = 255
        data[idx + 1] = 215
        data[idx + 2] = 80
        data[idx + 3] = 90
      }
      selectionOverlayCache.value = { width, height, image: imageData }
    }
    ctx.putImageData(selectionOverlayCache.value.image, 0, 0)
    if (selectionBounds.value) {
      ctx.strokeStyle = 'rgba(255, 215, 80, 0.9)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      const bounds = selectionBounds.value
      ctx.strokeRect(
        bounds.minX + 0.5,
        bounds.minY + 0.5,
        Math.max(1, bounds.maxX - bounds.minX + 1),
        Math.max(1, bounds.maxY - bounds.minY + 1)
      )
      ctx.setLineDash([])
    }
  }

  if (snapGuide.value && angleSnapEnabled.value) {
    const { start, end, angle } = snapGuide.value
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.7)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(start.x + 0.5, start.y + 0.5)
    ctx.lineTo(end.x + 0.5, end.y + 0.5)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(120, 220, 255, 0.9)'
    ctx.font = '12px "Space Grotesk", sans-serif'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${Math.round(angle)}°`, end.x + 6, end.y - 6)
  }

  if (!draft) {
    return
  }
  const x = Math.max(0, Math.min(width, draft.x))
  const y = Math.max(0, Math.min(height, draft.y))
  const w = Math.max(1, Math.min(width - x, draft.width))
  const h = Math.max(1, Math.min(height - y, draft.height))
  const stroke =
    draftMode === 'subtract'
      ? 'rgba(255, 120, 120, 0.9)'
      : draftMode === 'add'
        ? 'rgba(120, 220, 255, 0.9)'
        : 'rgba(255, 215, 80, 0.9)'
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2))
  ctx.setLineDash([])
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

function snapPoint(point: { x: number; y: number }) {
  if (!snapEnabled.value) return point
  const step = Math.max(1, snapSize.value)
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step
  }
}

function snapAngle(start: { x: number; y: number }, end: { x: number; y: number }) {
  if (!angleSnapEnabled.value) return end
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return end
  const angle = Math.atan2(dy, dx)
  const step = Math.PI / 12
  const snapped = Math.round(angle / step) * step
  return {
    x: start.x + Math.cos(snapped) * dist,
    y: start.y + Math.sin(snapped) * dist
  }
}

function getSelectionBounds(selection: SelectionData, width: number, height: number) {
  if (selection.type === 'rect') {
    const x = Math.max(0, Math.min(width - 1, Math.floor(selection.x)))
    const y = Math.max(0, Math.min(height - 1, Math.floor(selection.y)))
    const w = Math.max(1, Math.min(width - x, Math.floor(selection.width)))
    const h = Math.max(1, Math.min(height - y, Math.floor(selection.height)))
    return { x, y, width: w, height: h }
  }
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < selection.mask.length; i += 1) {
    if (!selection.mask[i]) continue
    const px = i % width
    const py = Math.floor(i / width)
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }
  if (maxX < 0 || maxY < 0) return null
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1)
  }
}

function renderPasteOverlay() {
  const buffer = pasteBuffer.value
  const position = pastePosition.value
  const overlay = overlayCanvasRef.value
  const ctx = getContext('overlay')
  const { width, height } = canvasDimensions.value
  if (!buffer || !position || !overlay || !ctx || !width || !height) return
  ctx.clearRect(0, 0, overlay.width, overlay.height)
  const imageData = ctx.createImageData(buffer.width, buffer.height)
  const data = imageData.data
  for (let i = 0; i < buffer.values.length; i += 1) {
    const alpha = buffer.mask[i] ? 255 : 0
    if (alpha === 0) continue
    const v = Math.round(buffer.values[i] * 255)
    const idx = i * 4
    data[idx] = v
    data[idx + 1] = v
    data[idx + 2] = v
    data[idx + 3] = alpha
  }
  ctx.putImageData(imageData, Math.round(position.x), Math.round(position.y))
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(
    Math.round(position.x) + 0.5,
    Math.round(position.y) + 0.5,
    buffer.width,
    buffer.height
  )
  ctx.setLineDash([])
}

function clearPasteOverlay() {
  pastePosition.value = null
  pasteDragOffset.value = null
  pasteFollowCursor.value = false
  pasteLocked.value = false
  pasteHover.value = false
  clearOverlay()
}

type PasteTransform = 'flip-h' | 'flip-v' | 'rotate-cw' | 'rotate-ccw'

function transformPasteBuffer(buffer: { width: number; height: number; values: Float32Array; mask: Uint8Array }, action: PasteTransform) {
  if (action === 'flip-h') {
    const nextValues = new Float32Array(buffer.width * buffer.height)
    const nextMask = new Uint8Array(buffer.width * buffer.height)
    for (let y = 0; y < buffer.height; y += 1) {
      for (let x = 0; x < buffer.width; x += 1) {
        const sourceIndex = y * buffer.width + x
        const destIndex = y * buffer.width + (buffer.width - 1 - x)
        nextValues[destIndex] = buffer.values[sourceIndex]
        nextMask[destIndex] = buffer.mask[sourceIndex]
      }
    }
    return { ...buffer, values: nextValues, mask: nextMask }
  }
  if (action === 'flip-v') {
    const nextValues = new Float32Array(buffer.width * buffer.height)
    const nextMask = new Uint8Array(buffer.width * buffer.height)
    for (let y = 0; y < buffer.height; y += 1) {
      for (let x = 0; x < buffer.width; x += 1) {
        const sourceIndex = y * buffer.width + x
        const destIndex = (buffer.height - 1 - y) * buffer.width + x
        nextValues[destIndex] = buffer.values[sourceIndex]
        nextMask[destIndex] = buffer.mask[sourceIndex]
      }
    }
    return { ...buffer, values: nextValues, mask: nextMask }
  }
  const nextWidth = buffer.height
  const nextHeight = buffer.width
  const nextValues = new Float32Array(nextWidth * nextHeight)
  const nextMask = new Uint8Array(nextWidth * nextHeight)
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const sourceIndex = y * buffer.width + x
      const destIndex =
        action === 'rotate-cw'
          ? x * nextWidth + (nextWidth - 1 - y)
          : (nextHeight - 1 - x) * nextWidth + y
      nextValues[destIndex] = buffer.values[sourceIndex]
      nextMask[destIndex] = buffer.mask[sourceIndex]
    }
  }
  return { width: nextWidth, height: nextHeight, values: nextValues, mask: nextMask }
}

function applyPasteBuffer() {
  const buffer = pasteBuffer.value
  const position = pastePosition.value
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!buffer || !position || !values || !width || !height) return false
  const mode = pasteMode.value
  for (let y = 0; y < buffer.height; y += 1) {
    const destY = Math.round(position.y) + y
    if (destY < 0 || destY >= height) continue
    for (let x = 0; x < buffer.width; x += 1) {
      const destX = Math.round(position.x) + x
      if (destX < 0 || destX >= width) continue
      const sourceIndex = y * buffer.width + x
      if (!buffer.mask[sourceIndex]) continue
      const destIndex = destY * width + destX
      const sourceValue = buffer.values[sourceIndex]
      if (mode === 'merge') {
        const alpha = sourceValue
        const current = values[destIndex]
        values[destIndex] = current + alpha * (sourceValue - current)
      } else {
        values[destIndex] = sourceValue
      }
    }
  }
  renderMaskCanvas()
  renderPreviewCanvas()
  pushHistorySnapshot()
  pasteBuffer.value = null
  clearPasteOverlay()
  emit('selection-change', null)
  emit('paste-applied')
  return true
}

function buildPasteBufferFromImageData(imageData: ImageData) {
  const bufferValues = new Float32Array(imageData.width * imageData.height)
  const bufferMask = new Uint8Array(imageData.width * imageData.height)
  const data = imageData.data
  for (let i = 0; i < bufferValues.length; i += 1) {
    const idx = i * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3] / 255
    if (a <= 0) continue
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    const coverage = luminance * a
    if (coverage <= 0.01) continue
    bufferValues[i] = luminance
    bufferMask[i] = 1
  }
  return {
    width: imageData.width,
    height: imageData.height,
    values: bufferValues,
    mask: bufferMask
  }
}

function setPasteBufferFromImageData(imageData: ImageData) {
  pasteBuffer.value = buildPasteBufferFromImageData(imageData)
  return startPasteFromBuffer()
}

function beginPasteFromSelection() {
  const selection = selectionData.value
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!selection || !values || !width || !height) return false
  const bounds = getSelectionBounds(selection, width, height)
  if (!bounds) return false
  const bufferValues = new Float32Array(bounds.width * bounds.height)
  const bufferMask = new Uint8Array(bounds.width * bounds.height)
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceX = bounds.x + x
      const sourceY = bounds.y + y
      const sourceIndex = sourceY * width + sourceX
      const isSelected =
        selection.type === 'rect' ? true : selection.mask[sourceIndex] === 1
      if (!isSelected) continue
      const destIndex = y * bounds.width + x
      bufferValues[destIndex] = values[sourceIndex]
      bufferMask[destIndex] = 1
      values[sourceIndex] = 0
    }
  }
  pasteBuffer.value = {
    width: bounds.width,
    height: bounds.height,
    values: bufferValues,
    mask: bufferMask
  }
  renderMaskCanvas()
  renderPreviewCanvas()
  pushHistorySnapshot()
  pastePosition.value = { x: bounds.x, y: bounds.y }
  pasteFollowCursor.value = false
  pasteLocked.value = true
  renderPasteOverlay()
  emit('selection-change', null)
  return true
}

function applyPasteTransform(action: PasteTransform) {
  if (!pasteBuffer.value && selectionData.value) {
    if (!beginPasteFromSelection()) return false
  }
  if (!pasteBuffer.value || !pastePosition.value) return false
  const center = {
    x: pastePosition.value.x + pasteBuffer.value.width / 2,
    y: pastePosition.value.y + pasteBuffer.value.height / 2
  }
  pasteBuffer.value = transformPasteBuffer(pasteBuffer.value, action)
  pastePosition.value = {
    x: center.x - pasteBuffer.value.width / 2,
    y: center.y - pasteBuffer.value.height / 2
  }
  renderPasteOverlay()
  return true
}

function clearOverlay() {
  const ctx = getContext('overlay')
  const overlay = overlayCanvasRef.value
  if (ctx && overlay) {
    ctx.clearRect(0, 0, overlay.width, overlay.height)
  }
}

function stampBrush(x: number, y: number, angle = 0) {
  const ctx = getContext('overlay')
  const overlay = overlayCanvasRef.value
  if (!ctx || !overlay) return
  const radius = brushSize.value / 2
  if (radius <= 0) return
  const softness = brushSoftness.value
  const hardness = Math.max(0, 1 - softness)
  const innerRadius = Math.max(1, radius * hardness)
  const tint =
    currentStrokeMode.value === 'erase'
      ? '255,64,64'
      : currentStrokeMode.value === 'flat'
        ? '64,200,255'
        : '255,255,255'
  ctx.globalCompositeOperation = 'source-over'
  if (brushTexture.value === 'spray') {
    const shapeBound =
      brushShape.value === 'square'
        ? radius * Math.SQRT2
        : brushShape.value === 'triangle'
          ? radius * 1.2
          : radius
    const count = Math.max(12, Math.floor(radius * radius * 0.14))
    ctx.fillStyle = `rgba(${tint},1)`
    for (let i = 0; i < count; i += 1) {
      const rx = (Math.random() * 2 - 1) * shapeBound
      const ry = (Math.random() * 2 - 1) * shapeBound
      if (!isInsideShape(rx, ry, radius, angle)) continue
      const px = x + rx
      const py = y + ry
      ctx.globalAlpha = brushFlow.value * (0.35 + Math.random() * 0.6)
      ctx.fillRect(px, py, 1, 1)
    }
    ctx.globalAlpha = 1
    return
  }
  if (brushTexture.value === 'perlin') {
    const step = Math.max(1, Math.round(perlinScale.value / 6))
    const noiseScale = perlinScale.value
    const threshold = 1 - perlinDensity.value
    const rotation = (perlinRotation.value * Math.PI) / 180
    const noiseFalloffPower = 1 + (1 - perlinSoftness.value) * 2
    ctx.fillStyle = `rgba(${tint},1)`
    for (let oy = -radius; oy <= radius; oy += step) {
      for (let ox = -radius; ox <= radius; ox += step) {
        if (!isInsideShape(ox, oy, radius, angle)) continue
        const rotated = rotatePoint(ox, oy, rotation)
        const noise = valueNoise((x + rotated.x) / noiseScale, (y + rotated.y) / noiseScale)
        if (noise < threshold) continue
        const falloff = 1 - Math.min(1, Math.sqrt(ox * ox + oy * oy) / radius)
        const smoothed = Math.pow(falloff, noiseFalloffPower)
        ctx.globalAlpha = brushFlow.value * noise * smoothed
        ctx.fillRect(x + ox, y + oy, step, step)
      }
    }
    ctx.globalAlpha = 1
    return
  }
  if (brushShape.value === 'round') {
    if (hardness >= 0.99) {
      ctx.fillStyle = `rgba(${tint},1)`
      ctx.globalAlpha = brushFlow.value
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      return
    }
    const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, radius)
    gradient.addColorStop(0, `rgba(${tint},1)`)
    gradient.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = gradient
    ctx.globalAlpha = brushFlow.value
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    return
  }
  ctx.fillStyle = `rgba(${tint},1)`
  ctx.globalAlpha = brushFlow.value
  drawShape(ctx, x, y, radius, angle)
  ctx.globalAlpha = brushFlow.value * Math.max(0.25, softness * 0.6)
  drawShape(ctx, x, y, radius * 1.1, angle)
  ctx.globalAlpha = 1
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const sx = x - x0
  const sy = y - y0
  const n00 = hashNoise(x0, y0)
  const n10 = hashNoise(x1, y0)
  const n01 = hashNoise(x0, y1)
  const n11 = hashNoise(x1, y1)
  const ix0 = lerp(n00, n10, smoothStep(sx))
  const ix1 = lerp(n01, n11, smoothStep(sx))
  return lerp(ix0, ix1, smoothStep(sy))
}

function hashNoise(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function smoothStep(t: number) {
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function isInsideShape(dx: number, dy: number, radius: number, angle: number) {
  const rotated = rotatePoint(dx, dy, -angle)
  const rx = rotated.x
  const ry = rotated.y
  if (brushShape.value === 'round') {
    return rx * rx + ry * ry <= radius * radius
  }
  if (brushShape.value === 'square') {
    return Math.max(Math.abs(rx), Math.abs(ry)) <= radius
  }
  if (brushShape.value === 'line') {
    const halfThickness = radius * 0.25
    return Math.abs(ry) <= halfThickness && Math.abs(rx) <= radius
  }
  return pointInTriangle(rx, ry, radius)
}

function isSelectionCompatible(selection: SelectionData | null, width: number, height: number) {
  if (!selection) return false
  if (selection.type === 'rect') {
    return selection.canvasWidth === width && selection.canvasHeight === height
  }
  return selection.width === width && selection.height === height
}

function isSelectedIndex(index: number, width: number, height: number) {
  const selection = selectionData.value
  if (!selection) return true
  if (!isSelectionCompatible(selection, width, height)) return true
  if (selectionBounds.value) {
    const x = index % width
    const y = Math.floor(index / width)
    if (
      x < selectionBounds.value.minX ||
      x > selectionBounds.value.maxX ||
      y < selectionBounds.value.minY ||
      y > selectionBounds.value.maxY
    ) {
      return false
    }
  }
  if (selection.type === 'rect') {
    const x = index % width
    const y = Math.floor(index / width)
    return (
      x >= selection.x &&
      y >= selection.y &&
      x <= selection.x + selection.width &&
      y <= selection.y + selection.height
    )
  }
  return selection.mask[index] === 1
}

function isSelectedPoint(x: number, y: number, width: number, height: number) {
  const selection = selectionData.value
  if (!selection) return true
  if (!isSelectionCompatible(selection, width, height)) return true
  if (selectionBounds.value) {
    if (
      x < selectionBounds.value.minX ||
      x > selectionBounds.value.maxX ||
      y < selectionBounds.value.minY ||
      y > selectionBounds.value.maxY
    ) {
      return false
    }
  }
  if (selection.type === 'rect') {
    return (
      x >= selection.x &&
      y >= selection.y &&
      x <= selection.x + selection.width &&
      y <= selection.y + selection.height
    )
  }
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  return selection.mask[iy * width + ix] === 1
}

function selectionToMask(selection: SelectionData | null, width: number, height: number) {
  if (!selection) return null
  if (!isSelectionCompatible(selection, width, height)) return null
  if (selection.type === 'mask') {
    return new Uint8Array(selection.mask)
  }
  const mask = new Uint8Array(width * height)
  const x0 = Math.max(0, Math.floor(selection.x))
  const y0 = Math.max(0, Math.floor(selection.y))
  const x1 = Math.min(width, Math.floor(selection.x + selection.width))
  const y1 = Math.min(height, Math.floor(selection.y + selection.height))
  for (let y = y0; y < y1; y += 1) {
    const rowStart = y * width
    for (let x = x0; x < x1; x += 1) {
      mask[rowStart + x] = 1
    }
  }
  return mask
}

function updateSelectionBounds(selection: SelectionData | null) {
  const { width, height } = canvasDimensions.value
  if (!selection || !width || !height) {
    selectionBounds.value = null
    return
  }
  if (!isSelectionCompatible(selection, width, height)) {
    selectionBounds.value = null
    return
  }
  if (selection.type === 'rect') {
    const minX = Math.max(0, Math.floor(selection.x))
    const minY = Math.max(0, Math.floor(selection.y))
    const maxX = Math.min(width - 1, Math.floor(selection.x + selection.width))
    const maxY = Math.min(height - 1, Math.floor(selection.y + selection.height))
    selectionBounds.value = { minX, minY, maxX, maxY }
    return
  }
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < selection.mask.length; i += 1) {
    if (!selection.mask[i]) continue
    const px = i % width
    const py = Math.floor(i / width)
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }
  if (maxX < 0 || maxY < 0) {
    selectionBounds.value = null
    return
  }
  selectionBounds.value = { minX, minY, maxX, maxY }
}

function combineSelection(
  base: SelectionData | null,
  incoming: SelectionData | null,
  mode: 'replace' | 'add' | 'subtract'
) {
  if (!incoming) return base
  if (mode === 'replace' || !base) return incoming
  const { width, height } = canvasDimensions.value
  if (!width || !height) return incoming
  const baseMask = selectionToMask(base, width, height)
  const nextMask = selectionToMask(incoming, width, height)
  if (!baseMask || !nextMask) return incoming
  const combined = new Uint8Array(width * height)
  if (mode === 'add') {
    for (let i = 0; i < combined.length; i += 1) {
      combined[i] = baseMask[i] || nextMask[i] ? 1 : 0
    }
  } else {
    for (let i = 0; i < combined.length; i += 1) {
      combined[i] = baseMask[i] && !nextMask[i] ? 1 : 0
    }
  }
  return { type: 'mask' as const, width, height, mask: combined }
}

function drawShape(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  if (brushShape.value === 'square') {
    ctx.beginPath()
    ctx.rect(-radius, -radius, radius * 2, radius * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  if (brushShape.value === 'line') {
    const thickness = radius * 0.5
    ctx.beginPath()
    ctx.rect(-radius, -thickness / 2, radius * 2, thickness)
    ctx.fill()
    ctx.restore()
    return
  }
  if (brushShape.value === 'triangle') {
    const w = radius * 2
    const h = w * Math.sqrt(3) / 2
    const apexY = -2 * h / 3
    const baseY = h / 3
    ctx.beginPath()
    ctx.moveTo(0, apexY)
    ctx.lineTo(-w / 2, baseY)
    ctx.lineTo(w / 2, baseY)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function pointInTriangle(dx: number, dy: number, radius: number) {
  const w = radius * 2
  const h = w * Math.sqrt(3) / 2
  const ax = 0
  const ay = -2 * h / 3
  const bx = -w / 2
  const by = h / 3
  const cx = w / 2
  const cy = h / 3
  const v0x = cx - ax
  const v0y = cy - ay
  const v1x = bx - ax
  const v1y = by - ay
  const v2x = dx - ax
  const v2y = dy - ay
  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom
  return u >= 0 && v >= 0 && u + v <= 1
}

function rotatePoint(dx: number, dy: number, angle: number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  }
}

function drawStroke(fromX: number, fromY: number, toX: number, toY: number) {
  const spacingStep = Math.max(1, (brushSize.value / 4) * brushSpacing.value)
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(toX - fromX, toY - fromY) / spacingStep)
  )
  const angle = brushAngle.value
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps
    const x = fromX + (toX - fromX) * t
    const y = fromY + (toY - fromY) * t
    stampBrush(x, y, angle)
  }
}

function handlePointerDown(event: MouseEvent) {
  if (panModeActive.value || event.button !== 0) return
  markUserViewportInteraction()
  if (toolMode.value === 'grid') return
  const rawPoint = canvasCoordsFromEvent(event)
  const freehandOverride = event.ctrlKey || event.metaKey
  const snapped = toolMode.value === 'select' && angleSnapEnabled.value ? rawPoint : snapPoint(rawPoint)
  if (toolMode.value === 'transform' && selectionData.value && !pasteBuffer.value) {
    beginPasteFromSelection()
  }
  if (pasteFollowCursor.value && pasteBuffer.value && !pasteDragOffset.value) {
    pasteFollowCursor.value = false
    pasteLocked.value = true
    return
  }
  if (pastePosition.value && pasteBuffer.value) {
    const offsetX = rawPoint.x - pastePosition.value.x
    const offsetY = rawPoint.y - pastePosition.value.y
    if (
      offsetX >= 0 &&
      offsetY >= 0 &&
      offsetX <= pasteBuffer.value.width &&
      offsetY <= pasteBuffer.value.height
    ) {
      pasteDragOffset.value = { x: offsetX, y: offsetY }
      pasteLocked.value = true
      return
    }
    if (pasteLocked.value) {
      applyPasteBuffer()
    }
    return
  }
  if (toolMode.value === 'select') {
    const modifier = event.shiftKey ? 'add' : event.altKey || event.ctrlKey || event.metaKey ? 'subtract' : 'replace'
    selectionDraftMode.value = modifier
    if (selectionMode.value === 'fill') {
      const selection = combineSelection(selectionData.value, buildFillSelection(snapped.x, snapped.y), modifier)
      selectionDraft.value = null
      renderSelectionOverlay(selectionData.value ?? null, null, modifier)
      emit('selection-change', selection)
      return
    }
    selectionStart.value = snapped
    startPointerTracking()
    const draft = buildRectSelection(selectionStart.value, selectionStart.value)
    selectionDraft.value = draft
    requestAnimationFrame(() => {
      renderSelectionOverlay(selectionData.value ?? null, draft, modifier)
    })
    return
  }
  if (selectionData.value && !isSelectedPoint(snapped.x, snapped.y, canvasDimensions.value.width, canvasDimensions.value.height)) {
    return
  }
  if (flatSampleActive.value) {
    const sampled = sampleMaskValue(snapped.x, snapped.y)
    if (sampled !== null) {
      emit('flat-sample', sampled)
    }
    return
  }
  if (toolMode.value === 'fill') {
    clearFillPreview()
    fillAtPoint(snapped.x, snapped.y)
    return
  }
  if (event.shiftKey) {
    if (pendingAnchor.value) {
      clearOverlay()
      const lineEnd =
        angleSnapEnabled.value && !freehandOverride ? snapAngle(pendingAnchor.value, snapped) : snapped
      drawStroke(pendingAnchor.value.x, pendingAnchor.value.y, lineEnd.x, lineEnd.y)
      commitOverlay()
      pendingAnchor.value = lineEnd
      lastStrokePoint.value = lineEnd
      return
    }
    pendingAnchor.value = lastStrokePoint.value ?? snapped
    clearOverlay()
    if (!lastStrokePoint.value) {
      stampBrush(snapped.x, snapped.y, brushAngle.value)
    }
    return
  }
  pendingAnchor.value = null
  isDrawing.value = true
  strokeAnchor.value = snapped
  lastX.value = snapped.x
  lastY.value = snapped.y
  startPointerTracking()
  clearOverlay()
  stampBrush(snapped.x, snapped.y, brushAngle.value)
}

function handlePointerMove(event: MouseEvent) {
  if (panModeActive.value) return
  if (toolMode.value === 'select' && selectionStart.value) {
    const modifier = event.shiftKey ? 'add' : event.altKey || event.ctrlKey || event.metaKey ? 'subtract' : 'replace'
    selectionDraftMode.value = modifier
    const rawPoint = canvasCoordsFromEvent(event)
    const snapped = angleSnapEnabled.value ? rawPoint : snapPoint(rawPoint)
    const angled = snapAngle(selectionStart.value, snapped)
    if (angleSnapEnabled.value) {
      const dx = angled.x - selectionStart.value.x
      const dy = angled.y - selectionStart.value.y
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      snapGuide.value = { start: selectionStart.value, end: angled, angle }
    } else {
      snapGuide.value = null
    }
    const draft = buildRectSelection(selectionStart.value, angled)
    selectionDraft.value = draft
    requestAnimationFrame(() => {
      renderSelectionOverlay(selectionData.value ?? null, draft, modifier)
    })
    return
  }
  if (pasteDragOffset.value && pastePosition.value && pasteBuffer.value) {
    const rawPoint = canvasCoordsFromEvent(event)
    const desired = {
      x: rawPoint.x - pasteDragOffset.value.x,
      y: rawPoint.y - pasteDragOffset.value.y
    }
    const snapped = snapEnabled.value ? snapPoint(desired) : desired
    pastePosition.value = snapped
    renderPasteOverlay()
    return
  }
  if (pendingAnchor.value && !isDrawing.value) {
    const rawPoint = canvasCoordsFromEvent(event)
    const freehandOverride = event.ctrlKey || event.metaKey
    const snapped = snapPoint(rawPoint)
    const target =
      angleSnapEnabled.value && !freehandOverride ? snapAngle(pendingAnchor.value, snapped) : snapped
    if (angleSnapEnabled.value && !freehandOverride) {
      const dx = target.x - pendingAnchor.value.x
      const dy = target.y - pendingAnchor.value.y
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      snapGuide.value = { start: pendingAnchor.value, end: target, angle }
    } else {
      snapGuide.value = null
    }
    requestAnimationFrame(() => {
      renderSelectionOverlay(selectionData.value ?? null)
    })
    return
  }
  if (!isDrawing.value) return
  const rawPoint = canvasCoordsFromEvent(event)
  const freehandOverride = event.ctrlKey || event.metaKey
  const snapped = snapPoint(rawPoint)
  const anchor = strokeAnchor.value ?? { x: lastX.value, y: lastY.value }
  const target =
    angleSnapEnabled.value && !freehandOverride ? snapAngle(anchor, snapped) : snapped
  if (angleSnapEnabled.value && !freehandOverride) {
    const dx = target.x - anchor.x
    const dy = target.y - anchor.y
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    snapGuide.value = { start: anchor, end: target, angle }
  } else {
    snapGuide.value = null
  }
  requestAnimationFrame(() => {
    renderSelectionOverlay(selectionData.value ?? null)
  })
  drawStroke(lastX.value, lastY.value, target.x, target.y)
  lastX.value = target.x
  lastY.value = target.y
}

function handlePointerUp() {
  if (pasteDragOffset.value) {
    pasteDragOffset.value = null
    return
  }
  if (toolMode.value === 'select' && selectionStart.value) {
    const selection = combineSelection(selectionData.value, selectionDraft.value, selectionDraftMode.value)
    selectionStart.value = null
    selectionDraft.value = null
    snapGuide.value = null
    requestAnimationFrame(() => {
      renderSelectionOverlay(selectionData.value ?? null)
    })
    if (selection) {
      emit('selection-change', selection)
    }
    stopPointerTracking()
    return
  }
  if (!isDrawing.value) return
  isDrawing.value = false
  strokeAnchor.value = null
  snapGuide.value = null
  if (selectionData.value) {
    updateSelectionBounds(selectionData.value)
  }
  lastStrokePoint.value = { x: lastX.value, y: lastY.value }
  requestAnimationFrame(() => {
    renderSelectionOverlay(selectionData.value ?? null)
  })
  if (selectionData.value) {
    selectionApplyBusy.value = true
    requestAnimationFrame(() => {
      commitOverlay()
      selectionApplyBusy.value = false
    })
    stopPointerTracking()
    return
  }
  commitOverlay()
  stopPointerTracking()
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
    if (!isSelectedIndex(i / 4, width, height)) continue
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

async function copySelectionToClipboard() {
  const selection = selectionData.value
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!selection || !values || !width || !height) return false
  const bounds = getSelectionBounds(selection, width, height)
  if (!bounds) return false
  const bufferValues = new Float32Array(bounds.width * bounds.height)
  const bufferMask = new Uint8Array(bounds.width * bounds.height)
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceX = bounds.x + x
      const sourceY = bounds.y + y
      const sourceIndex = sourceY * width + sourceX
      const isSelected =
        selection.type === 'rect' ? true : selection.mask[sourceIndex] === 1
      const destIndex = y * bounds.width + x
      if (!isSelected) continue
      bufferValues[destIndex] = values[sourceIndex]
      bufferMask[destIndex] = 1
    }
  }
  pasteBuffer.value = {
    width: bounds.width,
    height: bounds.height,
    values: bufferValues,
    mask: bufferMask
  }

  const canvas = document.createElement('canvas')
  canvas.width = bounds.width
  canvas.height = bounds.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const imageData = ctx.createImageData(bounds.width, bounds.height)
  const data = imageData.data
  for (let i = 0; i < bufferValues.length; i += 1) {
    const alpha = bufferMask[i] ? 255 : 0
    if (alpha === 0) continue
    const v = Math.round(bufferValues[i] * 255)
    const idx = i * 4
    data[idx] = v
    data[idx + 1] = v
    data[idx + 2] = v
    data[idx + 3] = alpha
  }
  ctx.putImageData(imageData, 0, 0)
  try {
    if (navigator.clipboard?.write) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/png')
      })
      if (blob) {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
      }
    }
  } catch {
    return true
  }
  return true
}

function startPasteFromBuffer() {
  if (!pasteBuffer.value) return false
  const { width, height } = canvasDimensions.value
  const viewState = getViewState()
  const center = {
    x: (width || 0) * viewState.centerX,
    y: (height || 0) * viewState.centerY
  }
  pastePosition.value = {
    x: center.x - pasteBuffer.value.width / 2,
    y: center.y - pasteBuffer.value.height / 2
  }
  pasteFollowCursor.value = true
  pasteLocked.value = false
  renderPasteOverlay()
  return true
}

async function pasteFromClipboard() {
  if (!navigator.clipboard?.read) return false
  try {
    const items = await navigator.clipboard.read()
    const item = items.find((entry) => entry.types.includes('image/png'))
    if (!item) return false
    const blob = await item.getType('image/png')
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    return setPasteBufferFromImageData(imageData)
  } catch {
    return false
  }
}

function sampleMaskValue(x: number, y: number) {
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!values || !width || !height) return null
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  return values[iy * width + ix] ?? null
}

function scheduleFillPreview(x: number, y: number) {
  fillPreviewCoords.value = { x, y }
  if (fillPreviewActive.value) {
    fillPreviewActive.value = false
    clearOverlay()
  }
  fillPreviewLoading.value = false
  fillPreviewPending.value = true
  if (fillPreviewTimer !== null) {
    window.clearTimeout(fillPreviewTimer)
  }
  fillPreviewTimer = window.setTimeout(() => {
    fillPreviewTimer = null
    startFillPreview()
  }, 750)
}

function clearFillPreview() {
  if (pastePosition.value) return
  if (fillPreviewTimer !== null) {
    window.clearTimeout(fillPreviewTimer)
    fillPreviewTimer = null
  }
  if (fillPreviewActive.value || fillPreviewLoading.value) {
    fillPreviewActive.value = false
    fillPreviewLoading.value = false
    clearOverlay()
  }
  fillPreviewPending.value = false
}

function startFillPreview() {
  if (toolMode.value !== 'fill') return
  const coords = fillPreviewCoords.value
  if (!coords) return
  fillPreviewPending.value = false
  fillPreviewLoading.value = true
  requestAnimationFrame(() => {
    renderFillPreview(coords.x, coords.y)
    fillPreviewLoading.value = false
    fillPreviewActive.value = true
  })
}

function renderFillPreview(x: number, y: number) {
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  const overlay = overlayCanvasRef.value
  const ctx = getContext('overlay')
  if (!values || !width || !height || !overlay || !ctx) return
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  const startIndex = iy * width + ix
  const startValue = values[startIndex]
  if (!isSelectedIndex(startIndex, width, height)) {
    clearOverlay()
    return
  }
  const tolerance = fillTolerance.value
  const low = Math.min(startValue, tolerance)
  const high = Math.min(1 - startValue, tolerance)
  const visited = new Uint8Array(width * height)
  const stack: number[] = [startIndex]
  while (stack.length) {
    const index = stack.pop()
    if (index === undefined) continue
    if (visited[index]) continue
    visited[index] = 1
    if (!isSelectedIndex(index, width, height)) continue
    const value = values[index]
    if (value < startValue - low || value > startValue + high) continue
    const col = index % width
    if (col > 0) stack.push(index - 1)
    if (col < width - 1) stack.push(index + 1)
    if (index >= width) stack.push(index - width)
    if (index < width * (height - 1)) stack.push(index + width)
  }
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  for (let i = 0; i < visited.length; i += 1) {
    if (!visited[i]) continue
    const idx = i * 4
    data[idx] = 255
    data[idx + 1] = 215
    data[idx + 2] = 80
    data[idx + 3] = 110
  }
  ctx.clearRect(0, 0, overlay.width, overlay.height)
  ctx.putImageData(imageData, 0, 0)
}

function buildRectSelection(start: { x: number; y: number }, end: { x: number; y: number }) {
  const { width, height } = canvasDimensions.value
  if (!width || !height) return null
  const x = Math.max(0, Math.min(start.x, end.x))
  const y = Math.max(0, Math.min(start.y, end.y))
  const w = Math.max(1, Math.min(width - x, Math.abs(end.x - start.x)))
  const h = Math.max(1, Math.min(height - y, Math.abs(end.y - start.y)))
  return {
    type: 'rect' as const,
    x,
    y,
    width: w,
    height: h,
    canvasWidth: width,
    canvasHeight: height
  }
}

function buildFillSelection(x: number, y: number) {
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!values || !width || !height) return null
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  const startIndex = iy * width + ix
  const startValue = values[startIndex]
  const tolerance = fillTolerance.value
  const low = Math.min(startValue, tolerance)
  const high = Math.min(1 - startValue, tolerance)
  const visited = new Uint8Array(width * height)
  const selected = new Uint8Array(width * height)
  const stack: number[] = [startIndex]
  while (stack.length) {
    const index = stack.pop()
    if (index === undefined) continue
    if (visited[index]) continue
    visited[index] = 1
    const value = values[index]
    if (value < startValue - low || value > startValue + high) continue
    selected[index] = 1
    const col = index % width
    if (col > 0) stack.push(index - 1)
    if (col < width - 1) stack.push(index + 1)
    if (index >= width) stack.push(index - width)
    if (index < width * (height - 1)) stack.push(index + width)
  }
  return { type: 'mask' as const, width, height, mask: selected }
}

function fillAtPoint(x: number, y: number) {
  const values = maskValues.value
  const { width, height } = canvasDimensions.value
  if (!values || !width || !height) return
  const ix = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const iy = Math.min(height - 1, Math.max(0, Math.floor(y)))
  const startIndex = iy * width + ix
  const startValue = values[startIndex]
  if (!isSelectedIndex(startIndex, width, height)) return
  const fillValue = fillLevel.value
  const tolerance = fillTolerance.value
  const low = Math.min(startValue, tolerance)
  const high = Math.min(1 - startValue, tolerance)
  if (startValue === fillValue && low === 0 && high === 0) return
  const visited = new Uint8Array(width * height)
  const stack: number[] = [startIndex]
  while (stack.length) {
    const index = stack.pop()
    if (index === undefined) continue
    if (visited[index]) continue
    visited[index] = 1
    if (!isSelectedIndex(index, width, height)) continue
    const value = values[index]
    if (value < startValue - low || value > startValue + high) continue
    values[index] = fillValue
    const col = index % width
    if (col > 0) stack.push(index - 1)
    if (col < width - 1) stack.push(index + 1)
    if (index >= width) stack.push(index - width)
    if (index < width * (height - 1)) stack.push(index + width)
  }
  flashFillOverlay(visited)
  renderMaskCanvas()
  renderPreviewCanvas()
  pushHistorySnapshot()
}

function flashFillOverlay(visited: Uint8Array) {
  const { width, height } = canvasDimensions.value
  const overlay = overlayCanvasRef.value
  const ctx = getContext('overlay')
  if (!overlay || !ctx || !width || !height) return
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  for (let i = 0; i < visited.length; i += 1) {
    if (!visited[i]) continue
    const idx = i * 4
    data[idx] = 255
    data[idx + 1] = 210
    data[idx + 2] = 120
    data[idx + 3] = 140
  }
  ctx.clearRect(0, 0, overlay.width, overlay.height)
  ctx.putImageData(imageData, 0, 0)
  window.setTimeout(() => {
    clearOverlay()
  }, 260)
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
    if (viewport) {
      requestAnimationFrame(() => fitView())
    } else {
      zoom.value = 1
      emit('zoom-change', zoom.value)
    }
    return
  }
  if (viewport.clientWidth === 0 || viewport.clientHeight === 0) {
    requestAnimationFrame(() => fitView())
    return
  }
  const applyFit = (emitZoom: boolean) => {
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
    emit('cursor-move', { x: width / 2, y: height / 2 })
    if (emitZoom) {
      emit('zoom-change', zoom.value)
      viewInitialized = true
      suppressViewStateEmits = false
      emitViewStateChange({ force: true })
    }
  }

  applyFit(true)
  requestAnimationFrame(() => {
    if (!viewportRef.value) return
    applyNormalizedViewState({ zoom: zoom.value, centerX: 0.5, centerY: 0.5 }, false)
  })
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
  emit('cursor-move', { x: width * target.centerX, y: height * target.centerY })
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
    renderColorPreviewCanvas()
  }
)

watch(
  viewportRef,
  () => {
    tryApplyPendingViewState()
  }
)

watch(
  () => props.viewMode,
  () => {
    renderColorPreviewCanvas()
  }
)

watch(
  () => (props.maskColor ? props.maskColor.join(',') : ''),
  () => {
    renderColorPreviewCanvas()
  }
)

watch(
  () => props.valueMode,
  () => {
    renderColorPreviewCanvas()
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

function startPointerTracking() {
  if (pointerTrackingActive.value) return
  pointerTrackingActive.value = true
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', handlePointerUp)
}

function stopPointerTracking() {
  if (!pointerTrackingActive.value) return
  pointerTrackingActive.value = false
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', handlePointerUp)
}

function getCanvasSize() {
  return { ...canvasDimensions.value }
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
  getCanvasSize,
  seedHistory,
  suspendViewTracking,
  resumeViewTracking,
  copySelectionToClipboard,
  startPasteFromBuffer,
  beginPasteFromSelection,
  applyPasteTransform,
  applyPasteBuffer,
  clearPasteOverlay,
  pasteFromClipboard,
  setPasteBufferFromImageData
})

watch(
  () => [props.src, canvasRef.value] as const,
  () => loadImage(),
  { immediate: true }
)

watch(
  [gridEnabled, gridSize, gridMode, gridOpacity, gridColor, () => canvasDimensions.value.width, () => canvasDimensions.value.height],
  () => {
    renderGridOverlay()
  }
)

const selectionDraft = ref<SelectionRect | null>(null)
const selectionStart = ref<{ x: number; y: number } | null>(null)
const selectionDraftMode = ref<'replace' | 'add' | 'subtract'>('replace')
const selectionOverlayCache = ref<{ width: number; height: number; image: ImageData } | null>(null)
const selectionApplyBusy = ref(false)

watch(
  [selectionData, selectionDraft, selectionDraftMode, () => canvasDimensions.value.width, () => canvasDimensions.value.height],
  () => {
    renderSelectionOverlay(selectionData.value ?? null, selectionDraft.value ?? null, selectionDraftMode.value)
  },
  { deep: true }
)

watch(
  selectionData,
  () => {
    selectionOverlayCache.value = null
    updateSelectionBounds(selectionData.value ?? null)
  },
  { deep: true }
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
const cursorSampleValue = ref<number | null>(null)
const fillPreviewLoading = ref(false)
const fillPreviewPending = ref(false)
const fillPreviewActive = ref(false)
const fillPreviewCoords = ref<{ x: number; y: number } | null>(null)
let fillPreviewTimer: number | null = null
const fillSpinnerStyle = computed(() => ({
  left: `${cursorState.value.position.x}px`,
  top: `${cursorState.value.position.y}px`
}))
const debugCursor = ref(Boolean(import.meta.env.DEV))
const debugCoords = ref<{ x: number; y: number } | null>(null)
const debugDotStyle = computed(() => {
  if (!debugCursor.value || !debugCoords.value) return null
  const root = editorRootRef.value
  const canvas = canvasRef.value
  if (!root || !canvas) return null
  const rootRect = root.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  return {
    left: `${canvasRect.left + (debugCoords.value.x / canvas.width) * canvasRect.width - rootRect.left}px`,
    top: `${canvasRect.top + (debugCoords.value.y / canvas.height) * canvasRect.height - rootRect.top}px`
  }
})
const snapCoords = ref<{ x: number; y: number } | null>(null)
const snapDotStyle = computed(() => {
  if (!snapCoords.value) return null
  const root = editorRootRef.value
  const canvas = canvasRef.value
  if (!root || !canvas) return null
  const rootRect = root.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  return {
    left: `${canvasRect.left + (snapCoords.value.x / canvas.width) * canvasRect.width - rootRect.left}px`,
    top: `${canvasRect.top + (snapCoords.value.y / canvas.height) * canvasRect.height - rootRect.top}px`
  }
})

function updateCursorPosition(event: PointerEvent | MouseEvent) {
  const root = editorRootRef.value
  if (!root) return
  const canvas = canvasRef.value
  const rootRect = root.getBoundingClientRect()
  cursorState.value.position = {
    x: event.clientX - rootRect.left,
    y: event.clientY - rootRect.top
  }
  if (!canvas) {
    cursorState.value.visible = cursorInside.value && showCustomCursor.value
    debugCoords.value = null
    snapCoords.value = null
    return
  }
  const coords = canvasCoordsFromEvent(event as MouseEvent)
  const snapped = snapPoint(coords)
  lastCanvasCoords.value = { x: snapped.x, y: snapped.y }
  if (pasteBuffer.value && pastePosition.value && toolMode.value === 'select') {
    const hoverX = snapped.x - pastePosition.value.x
    const hoverY = snapped.y - pastePosition.value.y
    pasteHover.value =
      hoverX >= 0 &&
      hoverY >= 0 &&
      hoverX <= pasteBuffer.value.width &&
      hoverY <= pasteBuffer.value.height
  } else if (pasteHover.value) {
    pasteHover.value = false
  }
  debugCoords.value = coords
  if (snapEnabled.value && (Math.abs(coords.x - snapped.x) > 0.5 || Math.abs(coords.y - snapped.y) > 0.5)) {
    snapCoords.value = snapped
  } else {
    snapCoords.value = null
  }
  if (debugDotStyle.value) {
    cursorState.value.position = {
      x: parseFloat(debugDotStyle.value.left),
      y: parseFloat(debugDotStyle.value.top)
    }
  }
  cursorState.value.visible = cursorInside.value && showCustomCursor.value
  if (pasteFollowCursor.value && pasteBuffer.value) {
    const desired = {
      x: snapped.x - pasteBuffer.value.width / 2,
      y: snapped.y - pasteBuffer.value.height / 2
    }
    pastePosition.value = snapEnabled.value ? snapPoint(desired) : desired
    renderPasteOverlay()
  }
  if (flatSampleActive.value || toolMode.value === 'fill') {
    cursorSampleValue.value = sampleMaskValue(snapped.x, snapped.y)
  } else if (cursorSampleValue.value !== null) {
    cursorSampleValue.value = null
  }
  if (toolMode.value === 'fill' && !pastePosition.value) {
    scheduleFillPreview(snapped.x, snapped.y)
  } else if (!pastePosition.value) {
    clearFillPreview()
  }
  emit('cursor-move', {
    x: Math.round(snapped.x),
    y: Math.round(snapped.y)
  })
}

function handleViewportPointerEnter(event: PointerEvent) {
  cursorInside.value = true
  updateCursorPosition(event)
}

function handleViewportPointerLeave(event: PointerEvent) {
  cursorInside.value = false
  cursorState.value.visible = false
  cursorSampleValue.value = null
  snapGuide.value = null
  clearFillPreview()
  if (isPanning.value) {
    handleViewportPointerUp(event)
  }
}

watch(showCustomCursor, (canShow) => {
  cursorState.value.visible = canShow && cursorInside.value
})

watch(toolMode, (next) => {
  if (next !== 'fill') {
    clearFillPreview()
  }
})

onBeforeUnmount(() => {
  if (image.value?.src) {
    URL.revokeObjectURL(image.value.src)
  }
  clearFillPreview()
  stopPointerTracking()
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
  gap: 0.25rem;
  height: 100%;
  position: relative;
}

.layer-mask-editor__viewport {
  flex: 1;
  overflow: auto;
  border-radius: 0;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background-color: #000;
  padding: 0;
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

.layer-mask-editor__fill-spinner {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 6;
}

.layer-mask-editor__debug-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid rgba(255, 80, 80, 0.9);
  box-shadow: 0 0 6px rgba(255, 80, 80, 0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 7;
}

.layer-mask-editor__selection-working {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 215, 80, 0.4);
  background: rgba(10, 10, 12, 0.85);
  color: #ffe7a0;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  z-index: 7;
  pointer-events: none;
}

.layer-mask-editor__selection-working .layer-mask-editor__spinner {
  width: 18px;
  height: 18px;
}

.layer-mask-editor__snap-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid rgba(130, 200, 255, 0.95);
  box-shadow: 0 0 6px rgba(60, 120, 200, 0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 7;
}

.layer-mask-editor__spinner {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 2px solid rgba(255, 235, 140, 0.8);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.8);
  animation: layer-mask-editor-pulse 0.9s ease-in-out infinite;
}

.layer-mask-editor__fill-spinner--loading .layer-mask-editor__spinner {
  border-color: rgba(255, 235, 140, 0.98);
}

@keyframes layer-mask-editor-pulse {
  0% {
    border-color: rgba(255, 255, 255, 0.4);
  }
  50% {
    border-color: rgba(255, 235, 140, 0.95);
  }
  100% {
    border-color: rgba(255, 255, 255, 0.4);
  }
}


.layer-mask-editor__canvas-wrapper {
  position: relative;
  margin: 0 auto;
}

.layer-mask-editor__canvas-surface {
  position: relative;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 0;
  padding: 0;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.35);
  background: rgba(0, 0, 0, 0.8);
  min-width: 1px;
  min-height: 1px;
}

.layer-mask-editor__canvas {
  position: absolute;
  inset: 0;
  image-rendering: pixelated;
  background: transparent;
  display: block;
  width: 100%;
  height: 100%;
}

.layer-mask-editor__canvas--base {
  opacity: 0;
}

.layer-mask-editor__canvas--overlay {
  pointer-events: none;
}

.layer-mask-editor__canvas--luminance {
  mix-blend-mode: lighten;
}

.layer-mask-editor__canvas--preview {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  mix-blend-mode: normal;
}

.layer-mask-editor__canvas--grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.layer-mask-editor__canvas--color {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.2s ease;
}

.layer-mask-editor__canvas--selection {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
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
