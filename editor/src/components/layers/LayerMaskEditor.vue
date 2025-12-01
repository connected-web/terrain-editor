<template>
  <div class="layer-mask-editor">
    <div class="layer-mask-editor__toolbar">
      <div class="row row--slider">
        <span class="layer-mask-editor__label">Brush</span>
        <input
          v-model.number="brushSize"
          type="range"
          min="1"
          max="64"
        >
        <span class="layer-mask-editor__value">{{ brushSize }} px</span>
      </div>

      <div class="row row--mode">
        <span class="layer-mask-editor__label">Mode</span>
        <div class="layer-mask-editor__mode-buttons">
          <button
            type="button"
            class="pill-button"
            :class="{ 'pill-button--active': brushMode === 'paint' }"
            title="Paint (white)"
            aria-label="Paint (white)"
            @click="brushMode = 'paint'"
          >
            <Icon icon="paint-brush" aria-hidden="true" />
            <span class="sr-only">Paint (white)</span>
          </button>
          <button
            type="button"
            class="pill-button pill-button--ghost"
            :class="{ 'pill-button--active': brushMode === 'erase' }"
            title="Erase (black)"
            aria-label="Erase (black)"
            @click="brushMode = 'erase'"
          >
            <Icon icon="eraser" aria-hidden="true" />
            <span class="sr-only">Erase (black)</span>
          </button>
        </div>
      </div>

      <div class="row layer-mask-editor__toolbar-group">
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

    <div class="layer-mask-editor__viewport">
      <canvas
        ref="canvasRef"
        class="layer-mask-editor__canvas"
        @mousedown="handlePointerDown"
        @mousemove="handlePointerMove"
        @mouseup="handlePointerUp"
        @mouseleave="handlePointerUp"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  src: string | null
}>()

const emit = defineEmits<{
  (ev: 'update-mask', blob: Blob): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const originalImageData = ref<ImageData | null>(null)

const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const brushSize = ref(8)
const brushMode = ref<'paint' | 'erase'>('paint')

function getContext () {
  const canvas = canvasRef.value
  if (!canvas) return null
  return canvas.getContext('2d', { willReadFrequently: true })
}

function loadImage () {
  const canvas = canvasRef.value
  if (!canvas || !props.src) return

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
  }
}

function canvasCoordsFromEvent (event: MouseEvent) {
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

  ctx.strokeStyle = brushMode.value === 'paint' ? '#ffffff' : '#000000'
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
}

function handlePointerDown (event: MouseEvent) {
  const { x, y } = canvasCoordsFromEvent(event)
  isDrawing.value = true
  lastX.value = x
  lastY.value = y
  drawLine(x, y, x, y)
}

function handlePointerMove (event: MouseEvent) {
  if (!isDrawing.value) return
  const { x, y } = canvasCoordsFromEvent(event)
  drawLine(lastX.value, lastY.value, x, y)
  lastX.value = x
  lastY.value = y
}

function handlePointerUp () {
  isDrawing.value = false
}

function handleReset () {
  const canvas = canvasRef.value
  const ctx = getContext()
  if (!canvas || !ctx || !originalImageData.value) return

  canvas.width = originalImageData.value.width
  canvas.height = originalImageData.value.height
  ctx.putImageData(originalImageData.value, 0, 0)
}

function handleApply () {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.toBlob(blob => {
    if (blob) emit('update-mask', blob)
  }, 'image/png')
}

watch(
  () => props.src,
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
}

.layer-mask-editor__toolbar {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.row--slider {
  width: 100%;
}

.layer-mask-editor__mode-buttons {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.layer-mask-editor__toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.layer-mask-editor__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}

.layer-mask-editor__value {
  font-size: 0.75rem;
  opacity: 0.8;
}

.layer-mask-editor__viewport {
  flex: 1;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: radial-gradient(circle at top, #111827 0, #020617 55%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.layer-mask-editor__canvas {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
  background: #000;
  display: block;
  margin: 0 auto;
}
</style>
