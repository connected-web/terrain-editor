<template>
  <div class="layer-editor" :class="{ 'layer-editor--with-list': hasLayerList, 'layer-editor--inline': inlineMode }">
    <ConfirmDialog
      v-if="layerSwitchPrompt"
      :message="unsavedSwitchMessage"
      cancel-label="Stay here"
      secondary-label="Switch anyway"
      confirm-label="Apply & switch"
      confirm-variant="primary"
      @cancel="cancelLayerSwitchPrompt"
      @secondary="discardAndSwitch"
      @confirm="applyAndSwitch"
    />
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
          <button
            v-if="activeLayer"
            type="button"
            class="pill-button pill-button--ghost"
            @click="emit('open-assets', { id: activeLayer.id })"
          >
            <Icon icon="image">Assets</Icon>
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
              <button
                v-if="!isHeightmap"
                type="button"
                class="layer-editor__overflow-menu--danger"
                @click="requestActiveLayerDelete()"
              >
                <Icon icon="trash" /> Delete layer
              </button>
              <button type="button" class="layer-editor__overflow-menu--disabled" disabled title="Snap grid coming soon">
                <Icon icon="border-all" /> Snap (soon)
              </button>
            </div>
          </div>
          <button type="button" class="pill-button pill-button--ghost" aria-label="Close editor" @click="handleCloseEditor">
            <Icon icon="xmark" />
          </button>
        </div>
      </header>

      <div v-if="activeLayer" class="layer-editor__content">
        <div class="layer-editor__grid">
          <aside
            v-if="hasLayerList"
            class="layer-editor__layers"
          >
            <div class="layer-editor__layers-header">
              <div class="layer-editor__layers-title">
                <Icon icon="layer-group" aria-hidden="true" />
                <span>Layers</span>
              </div>
              <button type="button" class="pill-button pill-button--ghost layer-editor__layers-add" @click="handleLayerAdd">
                <Icon icon="plus" />
              </button>
            </div>
            <LayerList
              :sections="layerSections"
              :color-to-css="colorToCss"
              :active-id="props.activeLayer?.id ?? null"
              :section-hints="sectionHints"
              @open-layer="attemptLayerSelection"
              @toggle-layer="toggleLayerVisibility"
              @toggle-onion="toggleLayerOnion"
              @reorder-layer="emit('reorder-layer', $event)"
            />
            <div class="layer-editor__layers-actions">
              <button type="button" class="pill-button pill-button--ghost" @click="toggleGroupVisibility('biome')">
                <Icon icon="adjust" />
                {{ biomesFullyVisible ? 'Hide biomes' : 'Show biomes' }}
              </button>
              <button type="button" class="pill-button pill-button--ghost" @click="toggleGroupVisibility('overlay')">
                <Icon icon="layer-group" />
                {{ overlaysFullyVisible ? 'Hide overlays' : 'Show overlays' }}
              </button>
            </div>
          </aside>
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
              :title="tool.label"
              @click="selectTool(tool.id)"
            >
              <Icon :icon="tool.icon" aria-hidden="true" />
              <span class="layer-editor__tool-shortcut">{{ tool.shortcut }}</span>
              <span class="sr-only">{{ tool.label }}</span>
            </button>
          </aside>

        <div
          class="layer-editor__canvas"
          @dragenter.prevent="handleLayerDragEnter"
          @dragover.prevent="handleLayerDragOver"
          @dragleave.prevent="handleLayerDragLeave"
          @drop.prevent="handleLayerDrop"
        >
            <LayerMaskEditor
              v-if="maskUrl"
              ref="maskEditorRef"
              :src="maskUrl"
              :show-grid="previewBackground === 'grid'"
              :tool="activeTool"
              :value-mode="isHeightmap ? 'heightmap' : 'mask'"
              :view-mode="maskViewMode"
              :mask-color="props.activeLayer?.color ?? null"
              :brush-size="strokeSettings.size"
              :brush-opacity="strokeSettings.opacity"
              :brush-softness="strokeSettings.softness"
              :brush-flow="strokeSettings.flow"
              :brush-spacing="strokeSettings.spacing"
              :flat-level="toolSettings.flat.level"
              :flat-sample-mode="flatSampleMode"
              :onion-layers="onionLayerSources"
              @update-mask="handleUpdateMask"
              @zoom-change="handleZoomChange"
              @cursor-move="handleCursorMove"
              @history-change="handleHistoryChange"
              @ready="handleMaskReady"
              @view-change="handleMaskViewChange"
              @flat-sample="handleFlatSample"
            />
            <div v-else class="layer-editor__placeholder">
              <p>No mask image found for this layer.</p>
              <button
                v-if="props.activeLayer?.mask"
                type="button"
                class="pill-button pill-button--ghost"
                @click="emit('create-empty-mask', { id: props.activeLayer.id })"
              >
                <Icon icon="plus">Create empty mask</Icon>
              </button>
            </div>
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
                <label class="layer-editor__field">
                  <div class="layer-editor__field-header">
                    <span>Preset</span>
                    <div class="layer-editor__preset-icons">
                      <button
                        type="button"
                        class="layer-editor__icon-button"
                        :disabled="!canSavePreset"
                        aria-label="Save preset"
                        @click="saveCustomPreset"
                      >
                        <Icon icon="bookmark" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        class="layer-editor__icon-button layer-editor__icon-button--danger"
                        :disabled="!canDeletePreset"
                        aria-label="Delete preset"
                        @click="deleteActivePreset"
                      >
                        <Icon icon="trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <select v-model="activePresetId">
                    <option v-for="preset in presetOptions" :key="preset.id" :value="preset.id">
                      {{ preset.label }}
                    </option>
                  </select>
                </label>
                <label class="layer-editor__slider-field">
                  <div class="layer-editor__slider-label">
                    <span>Size (px)</span>
                    <button
                      type="button"
                      class="layer-editor__pin-button"
                      :class="{ 'layer-editor__pin-button--active': pinState.size }"
                      @click="togglePin('size')"
                    >
                      <Icon icon="thumbtack">{{ pinState.size ? 'Pinned' : 'Pin' }}</Icon>
                    </button>
                  </div>
                  <div class="layer-editor__slider-input">
                    <input
                      type="range"
                      min="1"
                      max="256"
                      v-model.number="sizeValue"
                    >
                    <input
                      type="number"
                      min="1"
                      max="512"
                      v-model.number="sizeValue"
                    >
                  </div>
                </label>
                <label class="layer-editor__slider-field">
                  <div class="layer-editor__slider-label">
                    <span>Opacity (%)</span>
                    <button
                      type="button"
                      class="layer-editor__pin-button"
                      :class="{ 'layer-editor__pin-button--active': pinState.opacity }"
                      @click="togglePin('opacity')"
                    >
                      <Icon icon="thumbtack">{{ pinState.opacity ? 'Pinned' : 'Pin' }}</Icon>
                    </button>
                  </div>
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
                <div v-if="isHeightmap && activeTool === 'flat'" class="layer-editor__flat-preview">
                  <span class="layer-editor__flat-swatch" :style="flatSwatchStyle"></span>
                  <span class="layer-editor__flat-label">{{ flatPercent }}%</span>
                </div>
                <div v-if="isHeightmap && activeTool === 'flat'" class="layer-editor__inline-actions">
                  <button
                    type="button"
                    class="pill-button pill-button--ghost"
                    :class="{ 'pill-button--active': flatSampleMode }"
                    @click="toggleFlatSampleMode"
                  >
                    <Icon icon="eye-dropper">Ink from canvas</Icon>
                  </button>
                  <p class="layer-editor__inline-hint">
                    Click the canvas to sample a height value.
                  </p>
                </div>
              </div>
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
                  <span>Background</span>
                  <select v-model="previewBackground">
                    <option value="grid">Checkerboard</option>
                    <option value="solid">Solid black</option>
                  </select>
                </label>
                <label class="layer-editor__field">
                  <span>Mask view</span>
                  <div class="layer-editor__segment">
                    <button
                      type="button"
                      class="layer-editor__segment-button"
                      :class="{ 'layer-editor__segment-button--active': maskViewMode === 'grayscale' }"
                      @click="maskViewMode = 'grayscale'"
                    >
                      B/W
                    </button>
                    <button
                      type="button"
                      class="layer-editor__segment-button"
                      :class="{ 'layer-editor__segment-button--active': maskViewMode === 'color' }"
                      :disabled="isHeightmap"
                      @click="maskViewMode = 'color'"
                    >
                      Colour
                    </button>
                  </div>
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
                    @change="handleColourChange"
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
              <Icon icon="arrow-rotate-left">Reset</Icon>
            </button>
            <button type="button" class="pill-button pill-button--ghost layer-editor__status-button" :disabled="!historyState.canUndo" @click="undoCanvas">
              <Icon icon="rotate-left">Undo ({{ historyState.undoSteps }})</Icon>
            </button>
            <button type="button" class="pill-button pill-button--ghost layer-editor__status-button" :disabled="!historyState.canRedo" @click="redoCanvas">
              <Icon icon="rotate-right">Redo ({{ historyState.redoSteps }})</Icon>
            </button>
            <button type="button" class="pill-button" @click="applyCanvas">
              <Icon icon="shuffle">Apply</Icon>
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { TerrainDataset, TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import type { LayerEntry } from '../../composables/useLayersModel'
import type { BrushPreset as StoredBrushPreset, BrushSettings } from '../../composables/useLocalSettings'
import Icon from '../Icon.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import LayerMaskEditor from '../layers/LayerMaskEditor.vue'
import LayerList from '../layers/LayerList.vue'
import { buildLayerSections, type LayerSection, type LayerSectionKey } from '../../utils/layerSections'

const TOOL_PALETTE = [
  { id: 'brush', label: 'Brush', icon: 'paintbrush', shortcut: 'B', description: 'Paint layer values.', onlyHeightmap: false, disabled: false },
  { id: 'erase', label: 'Erase', icon: 'eraser', shortcut: 'E', description: 'Remove layer values.', onlyHeightmap: false, disabled: false },
  { id: 'flat', label: 'Flatten', icon: 'equals', shortcut: 'F', description: 'Set the heightmap to a flat value.', onlyHeightmap: true, disabled: false },
  { id: 'fill', label: 'Fill', icon: 'fill-drip', shortcut: 'G', description: 'Fill contiguous areas.', onlyHeightmap: false, disabled: true },
  { id: 'select', label: 'Select', icon: 'crosshairs', shortcut: 'S', description: 'Select pixels for transforms.', onlyHeightmap: false, disabled: true },
  { id: 'hand', label: 'Hand', icon: 'hand', shortcut: 'H', description: 'Pan the canvas.', onlyHeightmap: false, disabled: false },
  { id: 'transform', label: 'Transform', icon: 'up-down-left-right', shortcut: 'T', description: 'Transform selections.', onlyHeightmap: false, disabled: true }
] as const

type BrushPreset = {
  id: string
  label: string
  settings: {
    size: number
    opacity: number
    softness: number
    spacing: number
    flow: number
  }
}

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  getPreview?: (path: string) => string
  dataset?: TerrainDataset | null
  filterText?: string
  activeLayer: LayerEntry | null
  onionLayers?: Array<{ id: string; mask?: string | null; color: [number, number, number] }>
  layerEntries?: LayerEntry[]
  colorToCss?: (color: [number, number, number]) => string
  inline?: boolean
  pendingViewState?: LayerViewState | null
  maskViewMode?: 'grayscale' | 'color'
  brushSettings?: BrushSettings | null
  brushPresets?: StoredBrushPreset[]
}>()

const emit = defineEmits<{
  (ev: 'select', path: string): void
  (ev: 'remove', path: string): void
  (ev: 'export-layer'): void
  (ev: 'close'): void
  (ev: 'replace', asset: TerrainProjectFileEntry): void
  (ev: 'update-colour', payload: { id: string; color: [number, number, number] }): void
  (ev: 'update-layer-name', payload: { id: string; label: string }): void
  (ev: 'open-layer-editor', id: string): void
  (ev: 'toggle-layer', id: string): void
  (ev: 'set-all', kind: 'biome' | 'overlay', visible: boolean): void
  (ev: 'add-layer'): void
  (ev: 'reorder-layer', payload: { sourceId: string; targetId: string | null }): void
  (ev: 'toggle-onion', id: string): void
  (ev: 'delete-layer', id: string): void
  (ev: 'replace-layer-file', payload: { id: string; file: File }): void
  (ev: 'open-assets', payload: { id: string }): void
  (ev: 'create-empty-mask', payload: { id: string }): void
  (ev: 'view-state-change', payload: { id: string; state: LayerViewState }): void
  (ev: 'consume-pending-view-state'): void
  (ev: 'mask-view-change', mode: 'grayscale' | 'color'): void
  (ev: 'update-brush-settings', payload: BrushSettings): void
  (ev: 'update-brush-presets', payload: StoredBrushPreset[]): void
}>()

const layerName = ref('')
const inlineMode = computed(() => Boolean(props.inline))
watch(
  () => props.activeLayer,
  (next) => {
    layerName.value = next?.label ?? ''
  },
  { immediate: true }
)

const maskEditorRef = ref<InstanceType<typeof LayerMaskEditor> | null>(null)
const previewBackground = ref<'grid' | 'solid'>('grid')
const maskViewMode = ref<'grayscale' | 'color'>('grayscale')
const pendingMaskViewOverride = ref<'grayscale' | 'color' | null>(null)
const isHeightmap = computed(() => props.activeLayer?.kind === 'heightmap')
watch(
  () => props.maskViewMode,
  (next) => {
    if (next && next !== maskViewMode.value) {
      pendingMaskViewOverride.value = next
      if (isHeightmap.value && next === 'color') {
        maskViewMode.value = 'grayscale'
      } else {
        maskViewMode.value = next
      }
    }
  },
  { immediate: true }
)
watch(
  maskViewMode,
  (next, prev) => {
    if (next !== prev) {
      emit('mask-view-change', next)
    }
  }
)
const cursorCoords = ref({ x: 0, y: 0 })
const currentZoom = ref(1)
const historyState = ref({ canUndo: false, canRedo: false, undoSteps: 0, redoSteps: 0 })
const maskDirty = computed(() => Boolean(props.activeLayer && historyState.value.undoSteps > 0))
const showOverflowMenu = ref(false)
const overflowMenuRef = ref<HTMLElement | null>(null)
const overflowButtonRef = ref<HTMLButtonElement | null>(null)
const hasLayerList = computed(() => (props.layerEntries?.length ?? 0) > 0)
const layerList = computed(() => props.layerEntries ?? [])
const colorToCss = computed(
  () =>
    props.colorToCss ??
    ((color: [number, number, number]) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`)
)
const sectionHints: Record<LayerSectionKey, string> = {
  heightmap: 'Base terrain height data',
  biome: 'Entries lower in the list render on top',
  overlay: 'Later overlays appear above earlier ones'
}
const layerSections = computed(() => buildLayerSections(layerList.value))
const biomesFullyVisible = computed(() => {
  const section = layerSections.value.find((sec) => sec.key === 'biome')
  if (!section || !section.entries.length) return true
  return section.entries.every((entry) => entry.visible)
})
const overlaysFullyVisible = computed(() => {
  const section = layerSections.value.find((sec) => sec.key === 'overlay')
  if (!section || !section.entries.length) return true
  return section.entries.every((entry) => entry.visible)
})
const activeTool = ref<typeof TOOL_PALETTE[number]['id']>('brush')
const DEFAULT_PRESET_ID = 'default-48-100'
const CUSTOM_PRESET_ID = 'custom'
const basePresets = [
  {
    id: 'default-48-100',
    label: 'Default 48px / 100%',
    settings: { size: 48, opacity: 1, softness: 0.15, spacing: 1, flow: 1 }
  },
  {
    id: 'soft-64-85',
    label: 'Soft 64px / 85%',
    settings: { size: 64, opacity: 0.85, softness: 0.35, spacing: 1, flow: 0.8 }
  },
  {
    id: 'hard-32-100',
    label: 'Hard 32px / 100%',
    settings: { size: 32, opacity: 1, softness: 0.05, spacing: 0.8, flow: 1 }
  },
  {
    id: 'wide-96-70',
    label: 'Wide 96px / 70%',
    settings: { size: 96, opacity: 0.7, softness: 0.2, spacing: 1.2, flow: 0.75 }
  },
  {
    id: 'detail-20-90',
    label: 'Detail 20px / 90%',
    settings: { size: 20, opacity: 0.9, softness: 0.1, spacing: 0.7, flow: 1 }
  }
] satisfies BrushPreset[]
const activePresetId = ref(basePresets[0]?.id ?? DEFAULT_PRESET_ID)
const toolSettings = reactive({
  brush: { size: 48, opacity: 1, softness: 0.15, spacing: 1, flow: 1 },
  erase: { size: 48, opacity: 1, softness: 0.15, spacing: 1, flow: 1 },
  flat: { size: 64, opacity: 1, softness: 0.25, spacing: 1, flow: 1, level: 0.5 }
})
const pinState = reactive({ size: false, opacity: false })
const pinnedValues = reactive({
  size: toolSettings.brush.size,
  opacity: toolSettings.brush.opacity
})
const lastBrushSettingsSignature = ref('')
const customPresets = ref<StoredBrushPreset[]>([])

const strokeToolTarget = computed<'brush' | 'erase' | 'flat'>(() => {
  if (activeTool.value === 'erase') return 'erase'
  if (activeTool.value === 'flat') return 'flat'
  return 'brush'
})
const strokeSettings = computed(() => toolSettings[strokeToolTarget.value])
const sizeValue = computed({
  get: () => (pinState.size ? pinnedValues.size : strokeSettings.value.size),
  set: (value: number) => {
    const next = clamp(value, 1, 512)
    if (pinState.size) {
      applyPinnedValue('size', next)
    } else {
      strokeSettings.value.size = next
    }
  }
})
const opacityValue = computed({
  get: () => (pinState.opacity ? pinnedValues.opacity : strokeSettings.value.opacity),
  set: (value: number) => {
    const next = clamp(value, 0.05, 1)
    if (pinState.opacity) {
      applyPinnedValue('opacity', next)
    } else {
      strokeSettings.value.opacity = next
    }
  }
})
const opacityPercent = computed({
  get: () => Math.round(opacityValue.value * 100),
  set: (value: number) => {
    opacityValue.value = clamp(value / 100, 0.05, 1)
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
const flatSampleMode = ref(false)

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

watch(isHeightmap, (isH) => {
  if (!isH && activeTool.value === 'flat') {
    activeTool.value = 'brush'
  }
  if (isH && maskViewMode.value === 'color') {
    maskViewMode.value = 'grayscale'
  }
  if (!isH && pendingMaskViewOverride.value && pendingMaskViewOverride.value !== maskViewMode.value) {
    maskViewMode.value = pendingMaskViewOverride.value
  }
  if (!isH) {
    flatSampleMode.value = false
  }
})
watch(activeTool, (next) => {
  if (next !== 'flat') {
    flatSampleMode.value = false
  }
})

const toolPalette = computed(() =>
  TOOL_PALETTE.map((tool) => ({
    ...tool,
    disabled: tool.disabled
  }))
)
const toolShortcutMap = new Map(TOOL_PALETTE.map((tool) => [tool.shortcut.toLowerCase(), tool.id]))
type LayerViewState = {
  zoom: number
  centerX: number
  centerY: number
}
const viewStateCache = new Map<string, LayerViewState>()
const layerSwitchPrompt = ref<{ targetId: string } | null>(null)
const pendingApplySwitchId = ref<string | null>(null)
const unsavedSwitchMessage = computed(() => {
  if (!layerSwitchPrompt.value) return ''
  const target = layerList.value.find((entry) => entry.id === layerSwitchPrompt.value?.targetId)
  const label = target?.label ?? 'the selected layer'
  return `Apply your changes before switching to ${label}?`
})

function cacheActiveLayerViewState(targetId?: string | null) {
  const id = targetId ?? props.activeLayer?.id ?? null
  if (!id || !maskEditorRef.value) return
  const state = maskEditorRef.value.getViewState()
  viewStateCache.set(id, state)
  emit('view-state-change', { id, state })
}

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
const presetOptions = computed(() => {
  const options = [...basePresets, ...customPresets.value]
  if (activePresetId.value === CUSTOM_PRESET_ID || shouldSwitchToCustom()) {
    options.push({
      id: CUSTOM_PRESET_ID,
      label: formatCustomLabel(sizeValue.value, opacityValue.value),
      settings: {
        size: sizeValue.value,
        opacity: opacityValue.value,
        softness: strokeSettings.value.softness,
        spacing: strokeSettings.value.spacing,
        flow: strokeSettings.value.flow
      }
    })
  }
  return options
})
const canSavePreset = computed(() => activePresetId.value === CUSTOM_PRESET_ID)
const canDeletePreset = computed(() => customPresets.value.some((preset) => preset.id === activePresetId.value))
const flatSwatchStyle = computed(() => {
  const channel = Math.round(toolSettings.flat.level * 255)
  return {
    backgroundColor: `rgb(${channel}, ${channel}, ${channel})`
  }
})

function getPresetById(id: string) {
  return (
    basePresets.find((preset) => preset.id === id) ??
    customPresets.value.find((preset) => preset.id === id) ??
    null
  )
}

function formatCustomLabel(size: number, opacity: number) {
  const roundedSize = Math.round(size)
  const opacityPercent = Math.round(opacity * 100)
  return `Custom (${roundedSize}px / ${opacityPercent}%)`
}

function shouldSwitchToCustom() {
  if (activePresetId.value === CUSTOM_PRESET_ID) return false
  const preset = getPresetById(activePresetId.value)
  if (!preset) return false
  const current = toolSettings.brush
  return (
    current.size !== preset.settings.size ||
    current.opacity !== preset.settings.opacity ||
    current.softness !== preset.settings.softness ||
    current.spacing !== preset.settings.spacing ||
    current.flow !== preset.settings.flow
  )
}

function applyPinnedValue(key: 'size' | 'opacity', value: number) {
  pinnedValues[key] = value
  toolSettings.brush[key] = value
  toolSettings.erase[key] = value
  toolSettings.flat[key] = value
}

function togglePin(key: 'size' | 'opacity') {
  pinState[key] = !pinState[key]
  if (pinState[key]) {
    const current = strokeSettings.value[key]
    applyPinnedValue(key, current)
  }
}

function applyPreset(preset: BrushPreset) {
  toolSettings.brush = { ...toolSettings.brush, ...preset.settings }
  toolSettings.erase = { ...toolSettings.erase, ...preset.settings }
  toolSettings.flat = { ...toolSettings.flat, ...preset.settings }
  activePresetId.value = preset.id
  if (pinState.size) {
    applyPinnedValue('size', pinnedValues.size)
  }
  if (pinState.opacity) {
    applyPinnedValue('opacity', pinnedValues.opacity)
  }
}

function getBrushSettingsSnapshot(): BrushSettings {
  return {
    presetId: activePresetId.value,
    toolSettings: {
      brush: { ...toolSettings.brush },
      erase: { ...toolSettings.erase },
      flat: { ...toolSettings.flat }
    },
    pins: { ...pinState },
    pinnedValues: { ...pinnedValues }
  }
}

function serializeBrushSettings(settings: BrushSettings) {
  return JSON.stringify(settings)
}

function applyBrushSettings(settings: BrushSettings) {
  const presetExists = Boolean(getPresetById(settings.presetId))
  activePresetId.value = presetExists ? settings.presetId : basePresets[0]?.id ?? DEFAULT_PRESET_ID
  toolSettings.brush = { ...toolSettings.brush, ...settings.toolSettings.brush }
  toolSettings.erase = { ...toolSettings.erase, ...settings.toolSettings.erase }
  toolSettings.flat = { ...toolSettings.flat, ...settings.toolSettings.flat }
  pinState.size = settings.pins.size
  pinState.opacity = settings.pins.opacity
  pinnedValues.size = settings.pinnedValues.size
  pinnedValues.opacity = settings.pinnedValues.opacity
  if (pinState.size) {
    applyPinnedValue('size', pinnedValues.size)
  }
  if (pinState.opacity) {
    applyPinnedValue('opacity', pinnedValues.opacity)
  }
}

function toggleFlatSampleMode() {
  flatSampleMode.value = !flatSampleMode.value
}

function saveCustomPreset() {
  if (activePresetId.value !== CUSTOM_PRESET_ID) return
  const preset: StoredBrushPreset = {
    id: `custom-${Date.now()}`,
    label: formatCustomLabel(sizeValue.value, opacityValue.value),
    settings: {
      size: toolSettings.brush.size,
      opacity: toolSettings.brush.opacity,
      softness: toolSettings.brush.softness,
      spacing: toolSettings.brush.spacing,
      flow: toolSettings.brush.flow
    }
  }
  const nextPresets = [...customPresets.value, preset]
  customPresets.value = nextPresets
  activePresetId.value = preset.id
  emit('update-brush-presets', nextPresets)
}

function deleteActivePreset() {
  const targetId = activePresetId.value
  if (!customPresets.value.some((preset) => preset.id === targetId)) return
  const nextPresets = customPresets.value.filter((preset) => preset.id !== targetId)
  customPresets.value = nextPresets
  activePresetId.value = basePresets[0]?.id ?? DEFAULT_PRESET_ID
  emit('update-brush-presets', nextPresets)
}

function handleFlatSample(value: number) {
  toolSettings.flat.level = clamp(value, 0, 1)
  flatSampleMode.value = false
}

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
watch(activePresetId, (next) => {
  if (next === CUSTOM_PRESET_ID) return
  const preset = getPresetById(next)
  if (!preset) return
  applyPreset(preset)
})
watch(
  () => props.brushSettings,
  (next) => {
    if (!next) return
    const signature = serializeBrushSettings(next)
    if (signature === lastBrushSettingsSignature.value) return
    applyBrushSettings(next)
    lastBrushSettingsSignature.value = signature
  },
  { immediate: true }
)
watch(
  () => props.brushPresets,
  (next) => {
    customPresets.value = next ? [...next] : []
  },
  { immediate: true }
)
watch(
  [toolSettings, pinState, pinnedValues, activePresetId],
  () => {
    if (shouldSwitchToCustom()) {
      activePresetId.value = CUSTOM_PRESET_ID
    }
    const snapshot = getBrushSettingsSnapshot()
    const signature = serializeBrushSettings(snapshot)
    if (signature === lastBrushSettingsSignature.value) return
    lastBrushSettingsSignature.value = signature
    emit('update-brush-settings', snapshot)
  },
  { deep: true }
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
  maskEditorRef.value?.seedHistory()
  if (pendingApplySwitchId.value) {
    const targetId = pendingApplySwitchId.value
    pendingApplySwitchId.value = null
    emit('open-layer-editor', targetId)
  }
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

function handleMaskReady() {
  if (!maskEditorRef.value) return
  const currentId = props.activeLayer?.id ?? null
  const pendingState = props.pendingViewState ?? null
  maskEditorRef.value.suspendViewTracking()
  if (pendingState) {
    const shouldAutoFit =
      pendingState.zoom <= 1 &&
      pendingState.centerX <= 0.05 &&
      pendingState.centerY <= 0.05
    if (shouldAutoFit) {
      fitCanvasView()
      if (currentId) {
        const viewState = maskEditorRef.value.getViewState()
        viewStateCache.set(currentId, viewState)
        emit('view-state-change', { id: currentId, state: viewState })
      }
      emit('consume-pending-view-state')
      maskEditorRef.value.resumeViewTracking()
      return
    }
    maskEditorRef.value.restoreViewState(pendingState, { emit: false })
    if (currentId) {
      viewStateCache.set(currentId, pendingState)
      emit('view-state-change', { id: currentId, state: pendingState })
    }
    emit('consume-pending-view-state')
  } else {
    const cachedState = currentId ? viewStateCache.get(currentId) ?? null : null
    if (cachedState && currentId) {
      maskEditorRef.value.restoreViewState(cachedState, { emit: false })
      emit('view-state-change', { id: currentId, state: cachedState })
    } else {
      fitCanvasView()
    }
  }
  maskEditorRef.value.resumeViewTracking()
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

function handleMaskViewChange(state: LayerViewState) {
  const id = props.activeLayer?.id
  if (!id) return
  viewStateCache.set(id, state)
  emit('view-state-change', { id, state })
}

function attemptLayerSelection(id: string) {
  if (!props.activeLayer || props.activeLayer.id === id) return
  cacheActiveLayerViewState()
  if (maskDirty.value) {
    layerSwitchPrompt.value = { targetId: id }
    return
  }
  emit('open-layer-editor', id)
}

function toggleLayerVisibility(id: string) {
  emit('toggle-layer', id)
}

function toggleLayerOnion(id: string) {
  emit('toggle-onion', id)
}

function toggleGroupVisibility(kind: 'biome' | 'overlay') {
  const section = layerSections.value.find((sec) => sec.key === kind)
  if (!section || !section.entries.length) return
  const shouldShow = section.entries.some((entry) => !entry.visible)
  emit('set-all', kind, shouldShow)
}

function cancelLayerSwitchPrompt() {
  layerSwitchPrompt.value = null
}

function discardAndSwitch() {
  if (!layerSwitchPrompt.value) return
  const { targetId } = layerSwitchPrompt.value
  layerSwitchPrompt.value = null
  emit('open-layer-editor', targetId)
}

function applyAndSwitch() {
  if (!layerSwitchPrompt.value) return
  pendingApplySwitchId.value = layerSwitchPrompt.value.targetId
  layerSwitchPrompt.value = null
  applyCanvas()
}

function requestActiveLayerDelete() {
  if (!props.activeLayer || isHeightmap.value) return
  cacheActiveLayerViewState()
  emit('delete-layer', props.activeLayer.id)
  toggleOverflowMenu(false)
}

function handleLayerAdd() {
  emit('add-layer')
}

function handleCloseEditor() {
  cacheActiveLayerViewState()
  emit('close')
}

function hasFilePayload(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function handleLayerDragEnter(event: DragEvent) {
  if (!hasFilePayload(event)) return
}

function handleLayerDragOver(event: DragEvent) {
  if (!hasFilePayload(event)) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleLayerDragLeave(event: DragEvent) {
  if (!hasFilePayload(event)) return
}

function handleLayerDrop(event: DragEvent) {
  if (!hasFilePayload(event)) return
  const file = event.dataTransfer?.files?.[0]
  if (!file || !props.activeLayer) return
  if (!file.type.startsWith('image/')) return
  emit('replace-layer-file', { id: props.activeLayer.id, file })
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
  cacheActiveLayerViewState()
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
  () => props.activeLayer?.id,
  (next, prev) => {
    if (prev) {
      cacheActiveLayerViewState(prev)
    }
  },
  { flush: 'sync' }
)

const supportsColourPicker = computed(() => props.activeLayer?.kind !== 'heightmap')

watch(
  () => props.pendingViewState,
  (next) => {
    if (!next || !maskEditorRef.value) return
    const currentId = props.activeLayer?.id ?? null
    maskEditorRef.value.suspendViewTracking()
    maskEditorRef.value.restoreViewState(next, { emit: false })
    if (currentId) {
      viewStateCache.set(currentId, next)
      emit('view-state-change', { id: currentId, state: next })
    }
    emit('consume-pending-view-state')
    maskEditorRef.value.resumeViewTracking()
  }
)

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
  --layer-editor-left-gap: 3.5rem;
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  padding: 1rem;
  padding-left: var(--layer-editor-left-gap);
}

.layer-editor--inline {
  position: relative;
  inset: auto;
  z-index: auto;
  display: flex;
  justify-content: flex-start;
  padding: 1rem;
  padding-left: max(2.5rem, 3vw);
  padding-right: max(1.5rem, 2vw);
  pointer-events: auto;
  width: 100%;
  height: 100%;
}

.layer-editor__panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  margin: 0;
  width: min(1400px, calc(100vw - var(--layer-editor-left-gap) - 2rem));
  height: calc(100vh - 2rem);
  background: rgba(5, 8, 17, 0.96);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  overflow: hidden;
}

.layer-editor--inline .layer-editor__panel {
  width: min(1400px, 100%);
  height: 100%;
  max-height: 100%;
  margin: 0 auto;
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

.layer-editor__overflow-menu--danger {
  color: #ff7b7b;
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
  grid-template-columns: 130px minmax(0, 1fr) 260px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.layer-editor--with-list .layer-editor__grid {
  grid-template-columns: 280px 80px minmax(0, 1fr) 260px;
}

.layer-editor__layers {
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.9rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.layer-editor__layers-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layer-editor__layers-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.layer-editor__layers-add {
  padding: 0.25rem 0.55rem;
  font-size: 0.85rem;
}

.layer-editor__layers-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.layer-editor__tools {
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  overflow-y: auto;
  align-items: center;
  min-height: 0;
}

.layer-editor__tool-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.35rem 0.4rem;
  text-transform: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  min-height: 56px;
}

.layer-editor__tool-button svg {
  font-size: 1rem;
}

.layer-editor__tool-shortcut {
  font-size: 0.75rem;
  opacity: 0.7;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layer-editor__canvas :deep(.layer-mask-editor) {
  height: 100%;
}

.layer-editor__canvas :deep(.layer-mask-editor__viewport) {
  height: 100%;
}

.layer-editor__properties {
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  min-height: 0;
}

.layer-editor__properties-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.layer-editor__properties-header h3 {
  margin: 0;
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

.layer-editor__flat-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.layer-editor__flat-swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.85);
}

.layer-editor__flat-label {
  font-weight: 600;
}

.layer-editor__slider-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.layer-editor__pin-button {
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.7rem;
  cursor: pointer;
}

.layer-editor__pin-button--active {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
}

.layer-editor__inline-actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-editor__inline-hint {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.75;
}

.pill-button--active {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.18);
}

.layer-editor__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.layer-editor__preset-icons {
  display: inline-flex;
  gap: 0.35rem;
}

.layer-editor__icon-button {
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  border-radius: 8px;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.layer-editor__icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.layer-editor__icon-button:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.12);
}

.layer-editor__icon-button--danger:not(:disabled):hover {
  border-color: rgba(255, 90, 90, 0.7);
  background: rgba(255, 90, 90, 0.2);
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

.layer-editor__segment {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.layer-editor__segment-button {
  border: none;
  background: transparent;
  color: inherit;
  padding: 0.25rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
  flex: 1 auto;
}

.layer-editor__segment-button--active {
  background: rgba(255, 255, 255, 0.18);
}

.layer-editor__segment-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
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
