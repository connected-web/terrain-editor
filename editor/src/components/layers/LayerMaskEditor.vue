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
          max="64"
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
          class="layer-mask-editor__canvas"
          :style="canvasStyle"
          draggable="false"
          @dragstart.prevent
          @mousedown="handlePointerDown"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="handlePointerUp"
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
}>()

const emit = defineEmits<{
  (ev: 'update-mask', blob: Blob): void
}>()

const editorRootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const originalImageData = ref<ImageData | null>(null)

const hasValidImage = computed(() => {
  return Boolean(props.src && image.value && originalImageData.value)
})

const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const brushSize = ref(8)
const brushOpacity = ref(1)
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
const canvasStyle = computed(() => ({
  width: '100%',
  height: '100%'
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

function getContext () {
  const canvas = canvasRef.value
  if (!canvas) return null
  return canvas.getContext('2d', { willReadFrequently: true })
}

function loadImage () {
  const canvas = canvasRef.value
  if (!canvas) return

  if (!props.src) {
    const ctx = getContext()
    if (ctx) {
      canvas.width = 1
      canvas.height = 1
      ctx.clearRect(0, 0, 1, 1)
    }
    originalImageData.value = null
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = props.src

  img.onload = () => {
    const ctx = getContext()
    if (!ctx) return

    canvas.width = img.width
    canvas.height = img.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    try {
      originalImageData.value = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch {
      originalImageData.value = null
    }

    image.value = img
    canvasDimensions.value = { width: canvas.width, height: canvas.height }
  }

  img.onerror = () => {
    const ctx = getContext()
    if (ctx) {
      canvas.width = 1
      canvas.height = 1
      ctx.clearRect(0, 0, 1, 1)
    }
    originalImageData.value = null
    image.value = null
    canvasDimensions.value = { width: 0, height: 0 }
  }
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

function drawLine (fromX: number, fromY: number, toX: number, toY: number) {
  const ctx = getContext()
  if (!ctx) return

  ctx.strokeStyle = activeAction.value === 'erase' ? '#000000' : '#ffffff'
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = Math.min(1, Math.max(0.01, brushOpacity.value))

  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function handlePointerDown (event: MouseEvent) {
  if (activeAction.value === 'pan') return
  const { x, y } = canvasCoordsFromEvent(event)
  isDrawing.value = true
  lastX.value = x
  lastY.value = y
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
  const canvas = canvasRef.value
  const ctx = getContext()
  if (!canvas || !ctx || !originalImageData.value) return

  canvas.width = originalImageData.value.width
  canvas.height = originalImageData.value.height
  ctx.putImageData(originalImageData.value, 0, 0)
  canvasDimensions.value = { width: canvas.width, height: canvas.height }
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
  'layer-mask-editor__viewport--pan': activeAction.value === 'pan'
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

watch(
  () => [props.src, canvasRef.value] as const,
  () => loadImage(),
  { immediate: true }
)

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
  background: radial-gradient(circle at top, #121829 0, #050914 55%);
  padding: 0.5rem;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
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
