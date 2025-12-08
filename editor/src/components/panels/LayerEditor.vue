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
            @click="handleExportClick()"
          >
            <Icon icon="file-export">Export</Icon>
          </button>
          <div v-if="activeLayer" class="layer-editor__overflow">
            <button
              type="button"
              ref="overflowButtonRef"
              class="pill-button pill-button--ghost"
              aria-label="More actions"
              title="More actions"
              @click="toggleOverflowMenu()"
            >
              <Icon icon="ellipsis-vertical" />
            </button>
            <div v-if="showOverflowMenu" ref="overflowMenuRef" class="layer-editor__overflow-menu">
              <button type="button" @click="fitCanvasView(); toggleOverflowMenu(false)">
                <Icon icon="expand" /> Fit to viewport
              </button>
              <button type="button" @click="resetCanvas(); toggleOverflowMenu(false)">
                <Icon icon="arrow-rotate-left" /> Reset mask
              </button>
              <button type="button" @click="applyCanvas(); toggleOverflowMenu(false)">
                <Icon icon="floppy-disk" /> Apply changes
              </button>
              <button type="button" @click="setZoom(1); toggleOverflowMenu(false)">
                <Icon icon="magnifying-glass" /> Zoom 100%
              </button>
              <button type="button" :disabled="!historyState.canUndo" @click="undoCanvas(); toggleOverflowMenu(false)">
                <Icon icon="rotate-left" /> Undo
              </button>
              <button type="button" :disabled="!historyState.canRedo" @click="redoCanvas(); toggleOverflowMenu(false)">
                <Icon icon="rotate-right" /> Redo
              </button>
              <button type="button" @click="handleExportClick(true); toggleOverflowMenu(false)">
                <Icon icon="droplet" /> Export w/ alpha
              </button>
              <button type="button" class="layer-editor__overflow-menu--disabled" disabled title="Snap grid coming soon">
                <Icon icon="border-all" /> Snap (soon)
              </button>
            </div>
          </div>
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
              :title="tool.disabled ? 'Coming soon' : `${tool.label} (${tool.shortcut})`"
              @click="selectTool(tool.id)"
            >
              <Icon :icon="tool.icon" aria-hidden="true" />
              <span class="layer-editor__tool-label">{{ tool.label }}</span>
              <span class="layer-editor__tool-shortcut">{{ tool.shortcut }}</span>
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
              :brush-flow="strokeSettings.flow"
              :brush-spacing="strokeSettings.spacing"
              :flat-level="toolSettings.flat.level"
              :onion-layers="onionLayerSources"
              @update-mask="handleUpdateMask"
              @zoom-change="handleZoomChange"
              @cursor-move="handleCursorMove"
              @history-change="handleHistoryChange"
            />
            <p v-else class="layer-editor__placeholder">
              No mask image found for this layer.
            </p>
          </div>

          <aside class="layer-editor__properties">
            <div class="layer-editor__properties-header">
              <div>
                <h3>{{ currentTool.label }}</h3>
                <p class="layer-editor__properties-hint">{{ currentTool.description }}</p>
              </div>
            </div>
            <div class="layer-editor__properties-body">
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
              <div class="layer-editor__control-stack layer-editor__control-stack--advanced">
                <label class="layer-editor__slider-field">
                  <span>Spacing (%)</span>
                  <div class="layer-editor__slider-input">
                    <input type="range" min="20" max="200" v-model.number="spacingPercent">
                    <input type="number" min="20" max="200" v-model.number="spacingPercent">
                  </div>
                </label>
                <label class="layer-editor__slider-field">
                  <span>Flow (%)</span>
                  <div class="layer-editor__slider-input">
                    <input type="range" min="5" max="100" v-model.number="flowPercent">
                    <input type="number" min="5" max="100" v-model.number="flowPercent">
                  </div>
                </label>
              </div>
              <div class="layer-editor__section">
                <h4>Layer settings</h4>
                <label class="layer-editor__field">
                  <span>Preview</span>
                  <select v-model="layerPreviewMode">
                    <option value="mask">Mask</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </label>
                <label
                  v-if="supportsColourPicker && activeLayer"
                  class="layer-editor__field layer-editor__color-field"
                >
                  <span>Layer colour</span>
                  <input
                    type="color"
                    :value="layerColourHex"
                    aria-label="Layer colour"
                    @input="handleColourChange"
                  >
                </label>
              </div>
              <div class="layer-editor__section">
                <h4>Layer utilities</h4>
                <div class="layer-editor__properties-actions">
                  <button type="button" class="pill-button pill-button--ghost" @click="resetCanvas">
                    <Icon icon="arrow-rotate-left" /> Reset mask
                  </button>
                  <button type="button" class="pill-button" @click="applyCanvas">
                    <Icon icon="floppy-disk" /> Apply changes
                  </button>
                </div>
              </div>
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
            <button type="button" class="pill-button pill-button--ghost layer-editor__status-button" :disabled="!historyState.canUndo" @click="undoCanvas">
              <Icon icon="rotate-left" /> Undo ({{ historyState.undoSteps }})
            </button>
            <button type="button" class="pill-button pill-button--ghost layer-editor__status-button" :disabled="!historyState.canRedo" @click="redoCanvas">
              <Icon icon="rotate-right" /> Redo ({{ historyState.redoSteps }})
            </button>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
const cursorCoords = ref({ x: 0, y: 0 })
const currentZoom = ref(1)
const historyState = ref({ canUndo: false, canRedo: false, undoSteps: 0, redoSteps: 0 })
const showOverflowMenu = ref(false)
const overflowMenuRef = ref<HTMLElement | null>(null)
const overflowButtonRef = ref<HTMLButtonElement | null>(null)

const activeTool = ref<typeof TOOL_PALETTE[number]['id']>('brush')
const toolSettings = reactive({
  brush: { size: 48, opacity: 1, softness: 0.15, spacing: 1, flow: 1 },
  erase: { size: 48, opacity: 1, softness: 0.15, spacing: 1, flow: 1 },
  flat: { size: 64, opacity: 1, softness: 0.25, spacing: 1, flow: 1, level: 0.5 }
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
  get: () => Math.round(Math.sqrt(strokeSettings.value.softness) * 100),
  set: (value: number) => {
    const normalized = clamp(value / 100, 0, 1)
    strokeSettings.value.softness = clamp(normalized * normalized, 0, 1)
  }
})
const spacingPercent = computed({
  get: () => Math.round(strokeSettings.value.spacing * 100),
  set: (value: number) => {
    strokeSettings.value.spacing = clamp(value / 100, 0.2, 2)
  }
})
const flowPercent = computed({
  get: () => Math.round(strokeSettings.value.flow * 100),
  set: (value: number) => {
    strokeSettings.value.flow = clamp(value / 100, 0.05, 1)
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
const toolShortcutMap = new Map(TOOL_PALETTE.map((tool) => [tool.shortcut.toLowerCase(), tool.id]))

const currentTool = computed(() => toolPalette.value.find((tool) => tool.id === activeTool.value) ?? toolPalette.value[0])
const layerKindLabel = computed(() => {
  if (!props.activeLayer) return ''
  if (props.activeLayer.kind === 'heightmap') return 'Heightmap'
  return 'Mask'
})
const layerColourHex = computed(() => {
  const color = props.activeLayer?.color ?? [255, 255, 255]
  const toHex = (value: number) => value.toString(16).padStart(2, '0')
  return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`
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
  const tool = toolPalette.value.find((entry) => entry.id === id)
  if (!tool || tool.disabled || (tool.onlyHeightmap && !isHeightmap.value)) {
    return
  }
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

async function handleExportClick(includeAlpha = false) {
  const editor = maskEditorRef.value
  if (editor) {
    const blob = await editor.exportMask({ includeAlpha })
    if (blob) {
      const filenameBase = props.activeLayer?.label?.toLowerCase().replace(/\s+/g, '_') || 'layer'
      downloadBlob(blob, `${filenameBase}${includeAlpha ? '_alpha' : ''}.png`)
      return
    }
  }
  emit('export-layer')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function handleZoomChange(value: number) {
  currentZoom.value = value
}

function handleCursorMove(coords: { x: number; y: number }) {
  cursorCoords.value = coords
}

function undoCanvas() {
  maskEditorRef.value?.undo()
}

function redoCanvas() {
  maskEditorRef.value?.redo()
}

function handleHistoryChange(payload: { canUndo: boolean; canRedo: boolean; undoSteps: number; redoSteps: number }) {
  historyState.value = payload
}

function toggleOverflowMenu(force?: boolean) {
  showOverflowMenu.value = typeof force === 'boolean' ? force : !showOverflowMenu.value
}

function handleDocumentClick(event: MouseEvent) {
  if (!showOverflowMenu.value) return
  const target = event.target as Node | null
  if (
    overflowMenuRef.value?.contains(target as Node) ||
    overflowButtonRef.value?.contains(target as Node)
  ) {
    return
  }
  toggleOverflowMenu(false)
}

function handleGlobalKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return
  }
  const key = event.key.toLowerCase()
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redoCanvas()
    } else {
      undoCanvas()
    }
    return
  }
  if ((event.metaKey || event.ctrlKey) && (key === 'y')) {
    event.preventDefault()
    redoCanvas()
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const toolId = toolShortcutMap.get(key)
  if (toolId) {
    event.preventDefault()
    selectTool(toolId)
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('keydown', handleGlobalKeydown)
})

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
    settings.spacing = clamp(settings.spacing, 0.2, 2)
    settings.flow = clamp(settings.flow, 0.05, 1)
  },
  { deep: true }
)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
</script>

<style scoped>
.layer-editor {
  --layer-editor-left-gap: clamp(320px, 30vw, 520px);
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  padding: 1rem;
  padding-left: var(--layer-editor-left-gap);
}

.layer-editor__panel {
  display: flex;
  flex-direction: column;
  margin: 0;
  width: min(1100px, calc(100vw - var(--layer-editor-left-gap) - 2rem));
  height: calc(100vh - 2rem);
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

.layer-editor__overflow {
  position: relative;
}

.layer-editor__overflow-menu {
  position: absolute;
  top: 120%;
  right: 0;
  background: rgba(8, 12, 24, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.4rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 200px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  z-index: 20;
}

.layer-editor__overflow-menu button {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0.35rem 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
}

.layer-editor__overflow-menu button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.layer-editor__overflow-menu--disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  gap: 0.35rem;
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

.layer-editor__tool-label {
  font-size: 0.85rem;
  flex: 1;
  text-align: left;
}

.layer-editor__tool-shortcut {
  opacity: 0.65;
  font-size: 0.72rem;
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

.layer-editor__properties-tabs {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  padding: 0.15rem;
  gap: 0.25rem;
  margin-top: 0.2rem;
}

.layer-editor__properties-tabs button {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: pointer;
}

.layer-editor__properties-tabs__button--active {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.layer-editor__control-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.layer-editor__control-stack--advanced {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.layer-editor__slider-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-editor__slider-field span {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
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

.layer-editor__color-field input {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  width: 100%;
  height: 2.1rem;
  padding: 0.15rem;
}

.layer-editor__properties-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.layer-editor__status-button {
  min-width: 110px;
  justify-content: center;
}

.layer-editor__empty,
.layer-editor__placeholder {
  padding: 1rem;
  text-align: center;
  opacity: 0.75;
}

@media (max-width: 1100px) {
  .layer-editor {
    --layer-editor-left-gap: 1rem;
    padding-left: 1rem;
  }

  .layer-editor__grid {
    grid-template-columns: 160px minmax(0, 1fr) 220px;
  }
}
</style>
