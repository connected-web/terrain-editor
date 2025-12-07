<template>
  <div class="layer-editor">
    <section class="layer-editor__panel">
      <header class="layer-editor__header">
        <div class="layer-editor__header-left">
          <p class="layer-editor__eyebrow">Layer Editor</p>
          <template v-if="activeLayer">
            <div class="layer-editor__title-row">
              <input
                v-model="layerName"
                class="layer-editor__title-input"
                type="text"
                :placeholder="activeLayer.label"
                @keydown.enter.prevent="submitLayerName"
                @keydown.esc.prevent="resetLayerName"
                @blur="submitLayerName"
              >
              <span class="layer-editor__badge">{{ layerKindLabel }}</span>
            </div>
          </template>
          <h2 v-else>Select a layer</h2>
        </div>
        <div class="layer-editor__header-actions">
          <button
            v-if="activeLayer"
            type="button"
            class="pill-button"
            @click="$emit('export-layer')"
          >
            <Icon icon="file-export">Export</Icon>
          </button>
          <button type="button" class="pill-button pill-button--ghost" aria-label="More actions" title="More actions">
            <Icon icon="ellipsis-vertical" />
          </button>
          <button type="button" class="pill-button pill-button--ghost" aria-label="Close editor" @click="$emit('close')">
            <Icon icon="xmark" />
          </button>
        </div>
      </header>

      <div v-if="activeLayer" class="layer-editor__content">
        <div class="layer-editor__grid">
          <aside class="layer-editor__tools">
            <button
              v-for="tool in toolPalette"
              :key="tool.id"
              type="button"
              class="layer-editor__tool-button"
              :class="{
                'layer-editor__tool-button--active': tool.id === activeTool,
                'layer-editor__tool-button--disabled': tool.disabled || (tool.onlyHeightmap && !isHeightmap)
              }"
              :disabled="tool.disabled || (tool.onlyHeightmap && !isHeightmap)"
              @click="selectTool(tool.id)"
            >
              <Icon :icon="tool.icon" aria-hidden="true" />
              <span>{{ tool.label }}</span>
              <small>{{ tool.shortcut }}</small>
            </button>
          </aside>

          <div class="layer-editor__canvas">
            <LayerMaskEditor
              v-if="maskUrl"
              ref="maskEditorRef"
              :src="maskUrl"
              :show-grid="showGrid"
              :tool="activeTool"
              :value-mode="isHeightmap ? 'heightmap' : 'mask'"
              :brush-size="strokeSettings.size"
              :brush-opacity="strokeSettings.opacity"
              :brush-softness="strokeSettings.softness"
              :flat-level="toolSettings.flat.level"
              :onion-layers="onionLayerSources"
              @update-mask="handleUpdateMask"
              @zoom-change="handleZoomChange"
              @cursor-move="handleCursorMove"
            />
            <p v-else class="layer-editor__placeholder">
              No mask image found for this layer.
            </p>
          </div>

          <aside class="layer-editor__properties">
            <div class="layer-editor__properties-header">
              <div>
                <h3>Tool: {{ currentTool.label }}</h3>
                <p class="layer-editor__properties-hint">{{ currentTool.description }}</p>
              </div>
              <div class="layer-editor__properties-mode">
                <button
                  type="button"
                  class="pill-button pill-button--ghost"
                  :class="{ 'pill-button--active': propertyMode === 'basic' }"
                  @click="propertyMode = 'basic'"
                >
                  Basic
                </button>
                <button
                  type="button"
                  class="pill-button pill-button--ghost"
                  :class="{ 'pill-button--active': propertyMode === 'advanced' }"
                  @click="propertyMode = 'advanced'"
                >
                  Adv
                </button>
              </div>
            </div>
            <div v-if="propertyMode === 'basic'" class="layer-editor__properties-body">
              <div v-if="supportsBrushProperties" class="layer-editor__control-stack">
                <label class="layer-editor__slider-field">
                  <span>Size (px)</span>
                  <div class="layer-editor__slider-input">
                    <input
                      type="range"
                      min="1"
                      max="256"
                      v-model.number="strokeSettings.size"
                    >
                    <input
                      type="number"
                      min="1"
                      max="512"
                      v-model.number="strokeSettings.size"
                    >
                  </div>
                </label>
                <label class="layer-editor__slider-field">
                  <span>Opacity (%)</span>
                  <div class="layer-editor__slider-input">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      v-model.number="opacityPercent"
                    >
                    <input
                      type="number"
                      min="5"
                      max="100"
                      v-model.number="opacityPercent"
                    >
                  </div>
                </label>
                <label class="layer-editor__slider-field">
                  <span>Softness</span>
                  <div class="layer-editor__slider-input">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      v-model.number="softnessPercent"
                    >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      v-model.number="softnessPercent"
                    >
                  </div>
                </label>
                <label
                  v-if="isHeightmap && activeTool === 'flat'"
                  class="layer-editor__slider-field"
                >
                  <span>Flat level (%)</span>
                  <div class="layer-editor__slider-input">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      v-model.number="flatPercent"
                    >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      v-model.number="flatPercent"
                    >
                  </div>
                </label>
              </div>
              <p v-else class="layer-editor__placeholder-text">
                Tool options coming soon.
              </p>
              <div class="layer-editor__section">
                <h4>Layer settings</h4>
                <label class="layer-editor__field">
                  <span>Preview</span>
                  <select v-model="layerPreviewMode">
                    <option value="mask">Mask</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </label>
              </div>
            </div>
            <div v-else class="layer-editor__properties-body">
              <p class="layer-editor__placeholder-text">
                Advanced controls are on the roadmap.
              </p>
            </div>
          </aside>
        </div>

        <footer class="layer-editor__status">
          <div class="layer-editor__status-left">
            <button type="button" class="pill-button pill-button--ghost" @click="fitCanvasView">
              Fit
            </button>
            <button type="button" class="pill-button pill-button--ghost" @click="setZoom(1)">
              100%
            </button>
            <span>Zoom: {{ zoomLabel }}</span>
            <span>Coords: {{ coordLabel }}</span>
          </div>
          <div class="layer-editor__status-right">
            <button type="button" class="pill-button pill-button--ghost" @click="resetCanvas">
              <Icon icon="arrow-rotate-left" /> Reset
            </button>
            <button type="button" class="pill-button" @click="applyCanvas">
              <Icon icon="shuffle" /> Apply
            </button>
            <button type="button" class="pill-button pill-button--ghost" disabled>
              <Icon icon="rotate-left" /> Undo
            </button>
            <button type="button" class="pill-button pill-button--ghost" disabled>
              <Icon icon="rotate-right" /> Redo
            </button>
            <label class="layer-editor__snap-toggle">
              <input type="checkbox" v-model="snapEnabled">
              <span>Snap</span>
            </label>
          </div>
        </footer>
      </div>

      <div v-else class="layer-editor__empty">
        <p>Select a layer from the sidebar to edit its mask and colour.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { TerrainDataset, TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import type { LayerEntry } from '../../composables/useLayersModel'
import Icon from '../Icon.vue'
import LayerMaskEditor from '../layers/LayerMaskEditor.vue'

const TOOL_PALETTE = [
  { id: 'brush', label: 'Brush', icon: 'paintbrush', shortcut: 'B', description: 'Paint layer values.' },
  { id: 'erase', label: 'Erase', icon: 'eraser', shortcut: 'E', description: 'Remove layer values.' },
  { id: 'flat', label: 'Flatten', icon: 'equals', shortcut: 'F', description: 'Set the heightmap to a flat value.', onlyHeightmap: true },
  { id: 'fill', label: 'Fill', icon: 'fill-drip', shortcut: 'G', description: 'Fill contiguous areas.', disabled: true },
  { id: 'select', label: 'Select', icon: 'crosshairs', shortcut: 'S', description: 'Select pixels for transforms.', disabled: true },
  { id: 'hand', label: 'Hand', icon: 'hand', shortcut: 'H', description: 'Pan the canvas.' },
  { id: 'transform', label: 'Transform', icon: 'up-down-left-right', shortcut: 'T', description: 'Transform selections.', disabled: true }
] as const

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  getPreview?: (path: string) => string
  dataset?: TerrainDataset | null
  filterText?: string
  activeLayer: LayerEntry | null
  showGrid?: boolean
  onionLayers?: Array<{ id: string; mask?: string | null; color: [number, number, number] }>
}>()

const emit = defineEmits<{
  (ev: 'select', path: string): void
  (ev: 'remove', path: string): void
  (ev: 'export-layer'): void
  (ev: 'close'): void
  (ev: 'replace', asset: TerrainProjectFileEntry): void
  (ev: 'update-colour', payload: { id: string; color: [number, number, number] }): void
  (ev: 'update-layer-name', payload: { id: string; label: string }): void
}>()

const layerName = ref('')
watch(
  () => props.activeLayer,
  (next) => {
    layerName.value = next?.label ?? ''
  },
  { immediate: true }
)

const maskEditorRef = ref<InstanceType<typeof LayerMaskEditor> | null>(null)
const layerPreviewMode = ref<'mask' | 'overlay'>('mask')
const propertyMode = ref<'basic' | 'advanced'>('basic')
const snapEnabled = ref(false)
const cursorCoords = ref({ x: 0, y: 0 })
const currentZoom = ref(1)

const activeTool = ref<typeof TOOL_PALETTE[number]['id']>('brush')
const toolSettings = reactive({
  brush: { size: 48, opacity: 1, softness: 0.15 },
  erase: { size: 48, opacity: 1, softness: 0.15 },
  flat: { size: 64, opacity: 1, softness: 0.25, level: 0.5 }
})

const strokeToolTarget = computed<'brush' | 'erase' | 'flat'>(() => {
  if (activeTool.value === 'erase') return 'erase'
  if (activeTool.value === 'flat') return 'flat'
  return 'brush'
})
const strokeSettings = computed(() => toolSettings[strokeToolTarget.value])
const opacityPercent = computed({
  get: () => Math.round(strokeSettings.value.opacity * 100),
  set: (value: number) => {
    strokeSettings.value.opacity = clamp(value / 100, 0.05, 1)
  }
})
const softnessPercent = computed({
  get: () => Math.round(strokeSettings.value.softness * 100),
  set: (value: number) => {
    strokeSettings.value.softness = clamp(value / 100, 0, 1)
  }
})
const flatPercent = computed({
  get: () => Math.round(toolSettings.flat.level * 100),
  set: (value: number) => {
    toolSettings.flat.level = clamp(value / 100, 0, 1)
  }
})

const activeMaskAsset = computed(() => {
  if (!props.activeLayer?.mask) return null
  return props.assets.find((entry) => entry.path === props.activeLayer?.mask) ?? null
})

const maskObjectUrl = ref<string | null>(null)
const maskUrlOwned = ref(false)
const maskSignature = ref<string | null>(null)
let maskLoadToken = 0

type OnionLayerSource = { id: string; color: [number, number, number]; src: string | null }
const onionLayerSources = ref<OnionLayerSource[]>([])
const onionCache = new Map<string, { path: string | null; url: string | null; owned: boolean }>()
let onionLoadToken = 0

const isHeightmap = computed(() => props.activeLayer?.kind === 'heightmap')
watch(isHeightmap, (isH) => {
  if (!isH && activeTool.value === 'flat') {
    activeTool.value = 'brush'
  }
})

const toolPalette = computed(() =>
  TOOL_PALETTE.map((tool) => ({
    ...tool,
    disabled: tool.disabled
  }))
)

const currentTool = computed(() => toolPalette.value.find((tool) => tool.id === activeTool.value) ?? toolPalette.value[0])
const layerKindLabel = computed(() => {
  if (!props.activeLayer) return ''
  if (props.activeLayer.kind === 'heightmap') return 'Heightmap'
  return 'Mask'
})
const supportsBrushProperties = computed(() =>
  ['brush', 'erase', 'flat'].includes(activeTool.value)
)
const zoomLabel = computed(() => `${Math.round(currentZoom.value * 100)}%`)
const coordLabel = computed(() => `${Math.round(cursorCoords.value.x)}, ${Math.round(cursorCoords.value.y)}`)

watch(
  () => props.activeLayer?.label,
  (next) => {
    layerName.value = next ?? ''
  },
  { immediate: true }
)

watch(
  () => props.activeLayer,
  (next) => {
    if (!next) {
      activeTool.value = 'brush'
    }
  }
)

watch(
  () => props.onionLayers ?? [],
  async (layers) => {
    const token = ++onionLoadToken
    const nextSources: OnionLayerSource[] = []
    const nextIds = new Set(layers.map((layer) => layer.id))
    for (const [id, cached] of Array.from(onionCache.entries())) {
      if (!nextIds.has(id)) {
        if (cached.owned && cached.url) {
          URL.revokeObjectURL(cached.url)
        }
        onionCache.delete(id)
      }
    }
    for (const layer of layers) {
      const maskPath = layer.mask ?? null
      const cached = onionCache.get(layer.id)
      if (cached && cached.path === maskPath) {
        nextSources.push({ id: layer.id, color: layer.color, src: cached.url })
        continue
      }
      if (cached && cached.owned && cached.url) {
        URL.revokeObjectURL(cached.url)
      }
      const result = await resolveMaskSource(maskPath)
      if (token !== onionLoadToken) {
        if (result.owned && result.url) {
          URL.revokeObjectURL(result.url)
        }
        return
      }
      onionCache.set(layer.id, { path: maskPath, url: result.url, owned: result.owned })
      nextSources.push({ id: layer.id, color: layer.color, src: result.url })
    }
    if (token === onionLoadToken) {
      onionLayerSources.value = nextSources
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => {
    const asset = activeMaskAsset.value
    const path = props.activeLayer?.mask ?? null
    return {
      path,
      assetSignature: asset
        ? `${asset.path}:${asset.lastModified ?? 0}:${asset.data?.byteLength ?? 0}`
        : null,
      hasAssetData: Boolean(asset?.data?.byteLength),
      asset
    }
  },
  async ({ path, assetSignature, hasAssetData, asset }) => {
    const requestId = ++maskLoadToken
    if (!path) {
      setMaskUrl(null, false)
      maskSignature.value = null
      return
    }

    if (hasAssetData && assetSignature === maskSignature.value && maskObjectUrl.value) {
      return
    }

    if (hasAssetData && asset?.data) {
      const blob = new Blob([asset.data], { type: asset.type ?? 'image/png' })
      const url = URL.createObjectURL(blob)
      try {
        await preloadUrl(url)
        if (maskLoadToken === requestId) {
          setMaskUrl(url, true)
          maskSignature.value = assetSignature
        } else {
          URL.revokeObjectURL(url)
        }
      } catch {
        URL.revokeObjectURL(url)
      }
      return
    }

    const datasetUrl =
      (props.dataset ? await Promise.resolve(props.dataset.resolveAssetUrl(path)).catch(() => null) : null) ??
      (props.getPreview ? props.getPreview(path) : '')
    if (!datasetUrl) {
      if (maskLoadToken === requestId) {
        setMaskUrl(null, false)
        maskSignature.value = null
      }
      return
    }
    try {
      await preloadUrl(datasetUrl)
      if (maskLoadToken === requestId) {
        setMaskUrl(datasetUrl, false)
        maskSignature.value = `preview:${path}`
      }
    } catch {
      if (maskLoadToken === requestId) {
        setMaskUrl(null, false)
        maskSignature.value = null
      }
    }
  },
  { immediate: true }
)

function setMaskUrl(url: string | null, ownsUrl: boolean) {
  if (maskUrlOwned.value && maskObjectUrl.value) {
    URL.revokeObjectURL(maskObjectUrl.value)
  }
  maskObjectUrl.value = url
  maskUrlOwned.value = ownsUrl
}

async function preloadUrl(url: string) {
  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load mask preview'))
    img.src = url
  })
}

async function resolveMaskSource(path: string | null) {
  if (!path) {
    return { url: null, owned: false }
  }
  const asset = props.assets.find((entry) => entry.path === path)
  if (asset?.data?.byteLength) {
    const blob = new Blob([asset.data], { type: asset.type ?? 'image/png' })
    const url = URL.createObjectURL(blob)
    try {
      await preloadUrl(url)
      return { url, owned: true }
    } catch {
      URL.revokeObjectURL(url)
      return { url: null, owned: false }
    }
  }
  const datasetUrl =
    (props.dataset ? await Promise.resolve(props.dataset.resolveAssetUrl(path)).catch(() => null) : null) ??
    (props.getPreview ? props.getPreview(path) : '')
  if (!datasetUrl) {
    return { url: null, owned: false }
  }
  try {
    await preloadUrl(datasetUrl)
    return { url: datasetUrl, owned: false }
  } catch {
    return { url: null, owned: false }
  }
}

const maskUrl = computed(() => maskObjectUrl.value)

function handleColourChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  if (!input || !props.activeLayer) return
  const value = input.value
  const r = parseInt(value.slice(1, 3), 16)
  const g = parseInt(value.slice(3, 5), 16)
  const b = parseInt(value.slice(5, 7), 16)
  emit('update-colour', {
    id: props.activeLayer.id,
    color: [r, g, b]
  })
}

async function handleUpdateMask(blob: Blob) {
  if (!activeMaskAsset.value) return

  const data = await blob.arrayBuffer()
  emit('replace', {
    ...activeMaskAsset.value,
    data,
    lastModified: Date.now()
  })
}

function submitLayerName() {
  if (!props.activeLayer) return
  const trimmed = layerName.value.trim()
  if (!trimmed || trimmed === props.activeLayer.label) {
    layerName.value = props.activeLayer.label
    return
  }
  emit('update-layer-name', {
    id: props.activeLayer.id,
    label: trimmed
  })
}

function resetLayerName() {
  layerName.value = props.activeLayer?.label ?? ''
}

function selectTool(id: typeof TOOL_PALETTE[number]['id']) {
  activeTool.value = id
}

function fitCanvasView() {
  maskEditorRef.value?.fitView()
}

function setZoom(value: number) {
  maskEditorRef.value?.setZoom(value)
}

function resetCanvas() {
  maskEditorRef.value?.resetMask()
}

function applyCanvas() {
  maskEditorRef.value?.applyMask()
}

function handleZoomChange(value: number) {
  currentZoom.value = value
}

function handleCursorMove(coords: { x: number; y: number }) {
  cursorCoords.value = coords
}

onBeforeUnmount(() => {
  if (maskUrlOwned.value && maskObjectUrl.value) {
    URL.revokeObjectURL(maskObjectUrl.value)
  }
  maskObjectUrl.value = null
  maskSignature.value = null
  onionCache.forEach((entry) => {
    if (entry.owned && entry.url) {
      URL.revokeObjectURL(entry.url)
    }
  })
  onionCache.clear()
})

watch(
  () => props.activeLayer?.mask,
  () => {
    fitCanvasView()
  }
)

const supportsColourPicker = computed(() => props.activeLayer?.kind !== 'heightmap')

watch(
  strokeSettings,
  (settings) => {
    settings.size = clamp(settings.size, 1, 512)
    settings.opacity = clamp(settings.opacity, 0.05, 1)
    settings.softness = clamp(settings.softness, 0, 1)
  },
  { deep: true }
)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
</script>

<style scoped>
.layer-editor {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  padding: 0;
}

.layer-editor__panel {
  display: flex;
  flex-direction: column;
  margin: 1.5rem;
  width: min(960px, 96vw);
  height: calc(100vh - 3rem);
  background: rgba(5, 8, 17, 0.96);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  overflow: hidden;
}

.layer-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 1rem;
}

.layer-editor__header-left {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-editor__eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.layer-editor__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.layer-editor__title-input {
  width: 16rem;
  max-width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.layer-editor__badge {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.2rem 0.8rem;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.layer-editor__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.layer-editor__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.layer-editor__grid {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 260px;
  flex: 1;
  min-height: 0;
}

.layer-editor__tools {
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.layer-editor__tool-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.4rem 0.6rem;
  text-transform: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
}

.layer-editor__tool-button small {
  opacity: 0.65;
}

.layer-editor__tool-button--active {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.12);
}

.layer-editor__tool-button--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.layer-editor__canvas {
  position: relative;
  padding: 0.75rem;
  min-height: 0;
}

.layer-editor__canvas :deep(.layer-mask-editor) {
  height: 100%;
}

.layer-editor__properties {
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
}

.layer-editor__properties-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.layer-editor__properties-hint {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

.layer-editor__properties-mode {
  display: flex;
  gap: 0.4rem;
}

.pill-button--active {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.15);
}

.layer-editor__control-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.layer-editor__slider-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-editor__slider-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.layer-editor__slider-input input[type='range'] {
  flex: 1;
}

.layer-editor__slider-input input[type='number'] {
  width: 4.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.25rem 0.4rem;
  color: inherit;
}

.layer-editor__section {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.layer-editor__section h4 {
  margin: 0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.layer-editor__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.layer-editor__field select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.35rem 0.5rem;
  color: inherit;
}

.layer-editor__status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.85rem;
}

.layer-editor__status-left,
.layer-editor__status-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.layer-editor__snap-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
}

.layer-editor__empty,
.layer-editor__placeholder {
  padding: 1rem;
  text-align: center;
  opacity: 0.75;
}

@media (max-width: 1100px) {
  .layer-editor__grid {
    grid-template-columns: 160px minmax(0, 1fr) 220px;
  }
}
</style>
