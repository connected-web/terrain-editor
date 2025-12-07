<template>
  <div class="layer-mask-editor" ref="editorRootRef">
    <div class="layer-mask-editor__toolbar">
      <slot name="toolbar-prefix" />
      <div class="layer-mask-editor__control">
        <button
          type="button"
          class="circle-button"
          title="Brush size"
          aria-label="Brush size"
          disabled
        >
          <Icon icon="paintbrush" aria-hidden="true" />
        </button>
        <input
          v-model.number="brushSize"
          type="range"
          min="1"
          max="256"
        >
        <span class="layer-mask-editor__value">{{ brushSize }} px</span>
      </div>

      <div class="layer-mask-editor__control">
        <button
          type="button"
          class="circle-button"
          title="Brush opacity"
          aria-label="Brush opacity"
          disabled
        >
          <Icon icon="droplet" aria-hidden="true" />
        </button>
        <input
          v-model.number="brushOpacity"
          type="range"
          min="0.05"
          max="1"
          step="0.05"
        >
        <span class="layer-mask-editor__value">{{ Math.round(brushOpacity * 100) }}%</span>
      </div>

      <div class="layer-mask-editor__mode-buttons">
        <button
          v-for="action in actionButtons"
          :key="action.id"
          type="button"
          class="pill-button layer-mask-editor__action-button"
          :class="{
            'pill-button--ghost': activeAction !== action.id,
            'layer-mask-editor__action-button--active': activeAction === action.id
          }"
          :title="action.label"
          :aria-label="action.label"
          @click="setAction(action.id)"
        >
          <Icon :icon="action.icon" aria-hidden="true" />
          <span class="sr-only">{{ action.label }}</span>
        </button>
      </div>

      <div class="layer-mask-editor__control layer-mask-editor__zoom">
        <button
          type="button"
          class="circle-button"
          title="Zoom out"
          aria-label="Zoom out"
          @click="adjustZoom(-0.25)"
        >
          <Icon icon="magnifying-glass-minus" aria-hidden="true" />
        </button>
        <input
          v-model.number="zoom"
          type="range"
          min="0.5"
          max="4"
          step="0.25"
        >
        <button
          type="button"
          class="circle-button"
          title="Zoom in"
          aria-label="Zoom in"
          @click="adjustZoom(0.25)"
        >
          <Icon icon="magnifying-glass-plus" aria-hidden="true" />
        </button>
      </div>

      <div class="layer-mask-editor__toolbar-group">
        <button
          type="button"
          class="pill-button pill-button--ghost"
          title="Reset mask"
          aria-label="Reset mask"
          @click="handleReset"
        >
          <Icon icon="recycle" aria-hidden="true" />
          <span class="sr-only">Reset</span>
        </button>
        <button
          type="button"
          class="pill-button"
          title="Apply changes"
          aria-label="Apply changes"
          @click="handleApply"
        >
          <Icon icon="shuffle" aria-hidden="true" />
          <span class="sr-only">Apply changes</span>
        </button>
      </div>
    </div>

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
    >
      <div
        v-show="hasValidImage"
        class="layer-mask-editor__canvas-wrapper"
        :style="canvasWrapperStyle"
      >
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
        <canvas
          ref="overlayCanvasRef"
          class="layer-mask-editor__canvas layer-mask-editor__canvas--overlay"
          :style="overlayCanvasStyle"
          draggable="false"
          @dragstart.prevent
        />
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
      :mode="activeAction.value"
      :icon="activeCursorIcon"
      :opacity="brushOpacity"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import LayerMaskCursor from './LayerMaskCursor.vue'

const props = defineProps<{
  src: string | null
  showGrid?: boolean
}>()

const emit = defineEmits<{
  (ev: 'update-mask', blob: Blob): void
}>()

const editorRootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const maskValues = ref<Float32Array | null>(null)
const initialMaskValues = ref<Float32Array | null>(null)

const hasValidImage = computed(() => {
  return Boolean(props.src && maskValues.value && maskValues.value.length)
})

const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const brushSize = ref(8)
const brushOpacity = ref(1)
const currentStrokeMode = ref<'paint' | 'erase'>('paint')
const activeAction = ref<'paint' | 'erase' | 'pan'>('paint')
const actionButtons = [
  { id: 'paint', icon: 'paint-brush', label: 'Paint (white)' },
  { id: 'erase', icon: 'eraser', label: 'Erase (black)' },
  { id: 'pan', icon: 'up-down-left-right', label: 'Pan/Move' }
] as const
function setAction(action: (typeof actionButtons)[number]['id']) {
  activeAction.value = action
}
const activeCursorIcon = computed(() => actionButtons.find((item) => item.id === activeAction.value)?.icon ?? 'paint-brush')
const zoom = ref(1)
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const canvasDimensions = ref<{ width: number; height: number }>({ width: 0, height: 0 })
const canvasWrapperStyle = computed(() => ({
  width: `${Math.max(1, canvasDimensions.value.width * zoom.value)}px`,
  height: `${Math.max(1, canvasDimensions.value.height * zoom.value)}px`
}))
const overlayCanvasStyle = computed(() => ({
  opacity: Math.min(1, Math.max(0.01, brushOpacity.value))
}))

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function applyZoom(nextZoom: number, pivot?: { x: number; y: number }) {
  const viewport = viewportRef.value
  if (!viewport || !canvasDimensions.value.width || !canvasDimensions.value.height) {
    zoom.value = clampZoom(nextZoom)
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
  const prevOffsetX = prevScrollLeft + pivotX
  const prevOffsetY = prevScrollTop + pivotY
  const ratioX = prevDisplayWidth ? prevOffsetX / prevDisplayWidth : 0
  const ratioY = prevDisplayHeight ? prevOffsetY / prevDisplayHeight : 0
  zoom.value = clamped
  const nextScrollLeft = ratioX * nextDisplayWidth - pivotX
  const nextScrollTop = ratioY * nextDisplayHeight - pivotY
  viewport.scrollLeft = Math.max(0, nextScrollLeft)
  viewport.scrollTop = Math.max(0, nextScrollTop)
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

  function resetCanvases(width: number, height: number) {
    canvas.width = width
    canvas.height = height
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
  }

  img.onerror = () => {
    resetCanvases(1, 1)
    maskValues.value = new Float32Array(1)
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
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

function beginStroke() {
  const overlay = overlayCanvasRef.value
  if (!overlay) return
  const ctx = getContext('overlay')
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = currentStrokeMode.value === 'erase' ? '#fb6b6b' : '#ffffff'
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 1
}

function drawLine(fromX: number, fromY: number, toX: number, toY: number) {
  const ctx = getContext('overlay')
  if (!ctx) return
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
}

function handlePointerDown (event: MouseEvent) {
  if (activeAction.value === 'pan') return
  const { x, y } = canvasCoordsFromEvent(event)
  currentStrokeMode.value = activeAction.value === 'erase' ? 'erase' : 'paint'
  isDrawing.value = true
  lastX.value = x
  lastY.value = y
  clearOverlay()
  beginStroke()
  drawLine(x, y, x, y)
}

function handlePointerMove (event: MouseEvent) {
  if (activeAction.value === 'pan') return
  if (!isDrawing.value) return
  const { x, y } = canvasCoordsFromEvent(event)
  drawLine(lastX.value, lastY.value, x, y)
  lastX.value = x
  lastY.value = y
}

function handlePointerUp () {
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
  const erase = currentStrokeMode.value === 'erase'
  for (let i = 0; i < data.length; i += 4) {
    const alpha = (data[i + 3] / 255) * opacity
    if (alpha <= 0) continue
    const idx = i / 4
    const current = values[idx]
    if (erase) {
      values[idx] = Math.max(0, current - alpha * current)
    } else {
      values[idx] = Math.min(1, current + alpha * (1 - current))
    }
  }
  renderMaskCanvas()
  renderPreviewCanvas()
  clearOverlay()
}
const viewportRef = ref<HTMLDivElement | null>(null)
const isPanning = ref(false)
const panState = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

function handleViewportPointerDown(event: PointerEvent) {
  const viewport = viewportRef.value
  if (!viewport) return
  if (activeAction.value !== 'pan') {
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
}

function handleViewportPointerUp(event: PointerEvent) {
  if (!isPanning.value) return
  const viewport = viewportRef.value
  if (!viewport) return
  isPanning.value = false
  viewport.releasePointerCapture(event.pointerId)
}

function handleReset () {
  const values = initialMaskValues.value
  if (!values) return
  maskValues.value = new Float32Array(values)
  renderMaskCanvas()
  renderPreviewCanvas()
}

function handleApply () {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.toBlob(blob => {
    if (blob) emit('update-mask', blob)
  }, 'image/png')
}

function handleViewportWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
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

watch(
  () => [props.src, canvasRef.value] as const,
  () => loadImage(),
  { immediate: true }
)

const showCustomCursor = computed(() => hasValidImage.value && activeAction.value !== 'pan')
const viewportClasses = computed(() => ({
  'layer-mask-editor__viewport--draw': showCustomCursor.value,
  'layer-mask-editor__viewport--pan': activeAction.value === 'pan',
  'layer-mask-editor__viewport--grid': props.showGrid !== false
}))

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
</script>

<style scoped>
.layer-mask-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  position: relative;
}

.layer-mask-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 0.35rem;
}

.layer-mask-editor__control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.circle-button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.circle-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.layer-mask-editor__mode-buttons {
  display: flex;
  gap: 0.35rem;
}

.layer-mask-editor__action-button--active {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.layer-mask-editor__toolbar-group {
  display: flex;
  gap: 0.35rem;
  margin-left: auto;
}

.layer-mask-editor__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
}

.layer-mask-editor__value {
  font-size: 0.75rem;
  opacity: 0.85;
}

.layer-mask-editor__zoom input[type='range'] {
  width: 140px;
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
