<template>
  <div class="editor-shell" ref="editorRoot">
    <h1 class="sr-only">Terrain Editor v{{ version }}</h1>
    <div class="editor-layout">
      <EditorViewer
        ref="viewerShell"
        class="viewer-surface"
        :status="status"
        :status-fade="statusFaded"
        :ui-actions="uiActions"
        :show-toolbar-labels="isDockCollapsed"
        @load-file="loadArchiveFromFile"
        @toggle-fullscreen="toggleEditorFullscreen"
      />
      <PanelDock
        :collapsed="isDockCollapsed"
        :mobile="isCompactViewport"
        :expanded="dockExpanded"
        :hide-nav="hideDockNav"
        @toggle="toggleDock"
      >
        <template #nav>
          <div class="panel-dock__nav-stack">
            <button
              v-for="item in dockNavItems"
              :key="item.id"
              type="button"
              class="panel-dock__nav-button"
              :class="{ 'panel-dock__nav-button--active': activeDockPanel === item.id }"
              @click="setActivePanel(item.id)"
            >
              <Icon :icon="item.icon" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
            <div class="panel-dock__nav-divider"></div>
            <button type="button" class="panel-dock__nav-button" @click="openAssetsPanel()">
              <Icon icon="image" aria-hidden="true" />
              <span>Assets</span>
            </button>
            <button type="button" class="panel-dock__nav-button" @click="exportArchive">
              <Icon icon="file-export" aria-hidden="true" />
              <span>Export WYN</span>
            </button>
            <button type="button" class="panel-dock__nav-button panel-dock__nav-button--muted" @click="startNewMap()">
              <Icon icon="circle-xmark" aria-hidden="true" />
              <span>Close map</span>
            </button>
          </div>
        </template>
        <WorkspacePanel
          v-if="activeDockPanel === 'workspace'"
          :has-active-archive="hasActiveArchive"
          :thumbnail-url="thumbnailPreviewUrl"
          :has-thumbnail="hasThumbnailAsset"
          :is-creating-thumbnail="isCreatingThumbnail"
          :sample-maps="sampleMaps"
          :sample-map-id="sampleMapId"
          @select-sample="(id) => { sampleMapId = id }"
          @load-sample="loadSampleMapById"
          @load-map="triggerFileSelect"
          @start-new="startNewMap()"
          @export-archive="exportArchive"
          @select-thumbnail="openAssetsModalForThumbnail"
          @capture-thumbnail="captureThumbnailFromView"
        />

        <template v-else-if="activeDockPanel === 'layers'">
          <LayerEditor
            v-if="layersApi.layerEditorOpen.value"
            inline
            :assets="layerEditorAssets"
            :get-preview="getIconPreview"
            :dataset="datasetRef.value"
            :filter-text="assetDialogFilter"
            :active-layer="layersApi.activeLayer.value"
            :onion-layers="onionLayersForEditor"
            :layer-entries="layerEntriesWithOnion"
            :color-to-css="rgb"
            :pending-view-state="pendingViewStateForEditor"
            :mask-view-mode="maskViewMode"
            :brush-settings="localSettings.brushSettings"
            :brush-presets="localSettings.brushPresets"
            :grid-settings="localSettings.gridSettings"
            :panel-state="layerEditorPanelState"
            @update:filter-text="setAssetDialogFilter"
            @export-layer="layersApi.exportActiveLayerImage"
            @replace="handleLayerAssetReplace"
            @update-colour="handleLayerColourUpdate"
            @update-layer-name="handleLayerNameUpdate"
            @open-layer-editor="openLayerEditor"
            @toggle-layer="toggleLayer"
            @set-all="setAllLayers"
            @toggle-onion="toggleOnionLayer"
            @add-layer="openLayerCreateDialog()"
            @reorder-layer="handleLayerReorder"
            @delete-layer="handleLayerDelete"
            @view-state-change="handleLayerViewStateChange"
            @consume-pending-view-state="consumePendingLayerViewState"
            @mask-view-change="handleMaskViewChange"
            @replace-layer-file="handleLayerFileReplace"
            @open-assets="openAssetsModalForLayer"
            @create-empty-mask="handleCreateEmptyMask"
            @update-brush-settings="(next) => { localSettings.brushSettings = next }"
            @update-brush-presets="(next) => { localSettings.brushPresets = next }"
            @update-grid-settings="(next) => { localSettings.gridSettings = next }"
            @update-panel-state="updateLayerEditorPanelState"
            @close="layersApi.closeLayerEditor()"
          />
          <LayersPanel
            v-else
            :layer-entries="layerEntriesWithOnion"
            :color-to-css="rgb"
            @open-layer-editor="openLayerEditor"
            @toggle-layer="toggleLayer"
            @set-all="setAllLayers"
            @toggle-onion="toggleOnionLayer"
            @add-layer="openLayerCreateDialog()"
            @reorder-layer="handleLayerReorder"
          />
        </template>

        <ThemePanel
          v-else-if="activeDockPanel === 'theme'"
          :theme-form="themeForm"
          :stem-shape-options="stemShapeOptions"
          :has-active-archive="hasActiveArchive"
          @reset-theme="resetThemeForm"
          @schedule-update="scheduleThemeUpdate"
          @sprite-input="handleSpriteStateInput"
          @reset-sprite="resetSpriteState"
          @stem-input="handleStemStateInput"
          @reset-stem="resetStemState"
        />

        <AssetDialog
          v-else-if="activeDockPanel === 'assets'"
          embedded
          :assets="projectAssets"
          :get-preview="getIconPreview"
          :filter-text="assetDialogFilter"
          :show-close="true"
          :close-label="'Back'"
          :close-icon="'arrow-left'"
          :show-select="false"
          :select-label="assetsPanelSelectLabel"
          @update:filter-text="setAssetDialogFilter"
          @select="handleAssetPanelSelect"
          @replace="beginAssetReplacement"
          @upload="() => triggerLibraryUpload()"
          @remove="removeAsset"
          @close="setActivePanel('workspace')"
        />

        <SettingsPanel
          v-else-if="activeDockPanel === 'settings'"
          :local-settings="localSettings"
          :render-resolution="renderResolution"
        />

        <LocationsPanel
          v-else
          :locations-api="locationsApi"
          :get-icon-preview="getIconPreview"
          :has-legend="Boolean(projectSnapshot?.legend)"
          :disable-camera-actions="!handle"
          @open-icon-picker="openIconPicker"
          @open-picker="locationsApi.openLocationPicker"
          @clear-icon="clearLocationIcon"
          @drag-enter="onLocationsDragEnter"
          @drag-leave="onLocationsDragLeave"
          @drop="onLocationsDrop"
        />
      </PanelDock>
      <input
        type="file"
        accept="image/*"
        class="sr-only"
        ref="iconLibraryInputRef"
        @change="handleLibraryUpload"
      />
        <AssetDialog
          v-if="iconPickerTarget"
          :assets="projectAssets"
          :get-preview="getIconPreview"
          :filter-text="assetDialogFilter"
          :select-label="'Use icon'"
          :show-select="true"
          @update:filter-text="setAssetDialogFilter"
          @select="selectIconFromLibrary"
          @replace="beginAssetReplacement"
          @upload="() => triggerLibraryUpload()"
          @remove="removeAsset"
          @close="closeIconPicker"
        />
      <AssetDialog
        v-if="modalAssetPicker"
        :assets="projectAssets"
        :get-preview="getIconPreview"
        :filter-text="assetDialogFilter"
        :select-label="assetsPanelSelectLabel"
        :show-select="true"
        @update:filter-text="setAssetDialogFilter"
        @select="handleAssetPanelSelect"
        @replace="beginAssetReplacement"
        @upload="handleModalAssetUpload"
        @remove="removeAsset"
        @close="closeModalAssetPicker"
      />
      <LocationPickerDialog
        v-if="locationsApi.locationPickerOpen.value"
        :locations="locationsApi.locationsList.value"
        :active-id="locationsApi.selectedLocationId.value || undefined"
        @select="handleLocationSelect"
        @close="locationsApi.closeLocationPicker()"
      />
      <ConfirmDialog
        v-if="confirmState"
        :message="confirmState.message"
        :confirm-label="confirmState.confirmLabel"
        :cancel-label="confirmState.cancelLabel"
        :confirm-variant="confirmState.confirmVariant"
        @confirm="handleConfirmDialog"
        @cancel="dismissConfirmDialog"
      />
      <LayerCreateDialog
        v-if="layerCreateDialogOpen"
        @create="handleCreateLayer"
        @cancel="closeLayerCreateDialog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  buildWynArchive,
  createLayerBrowserStore,
  createProjectStore,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainLocation,
  type TerrainProjectFileEntry,
  type TerrainThemeOverrides,
  type ViewerOverlayLoadingState,
  type LocationViewState
} from '@connected-web/terrain-editor'
import {
  base64ToArrayBuffer,
  clearPersistedProject,
  persistProjectSnapshot,
  readPersistedProject,
  setAutoRestoreEnabled,
  shouldAutoRestoreProject,
  type PersistedProject
} from './utils/storage'
import {
  SpriteStateKey,
  StemStateKey,
  handleSpriteStateInput as handleSpriteStateInputHelper,
  handleStemStateInput as handleStemStateInputHelper,
  resetSpriteState as resetSpriteStateHelper,
  resetStemState as resetStemStateHelper,
  stemShapeOptions
} from './utils/theme'

const version = __APP_VERSION_FULL__
import { useTheme } from './composables/useTheme'
import { buildIconPath, buildLayerMaskPath, buildLayerTexturePath } from './utils/assets'
import { ensureLocationId } from './utils/locations'
import { useAssetLibrary } from './composables/useAssetLibrary'
import { useLocalSettings } from './composables/useLocalSettings'
import { useWorkspace } from './composables/useWorkspace'
import { registerViewerLocationResolver, type DockPanel } from './models/workspace'
import { useLocations } from './composables/useLocations'
import EditorViewer from './components/EditorViewer.vue'
import PanelDock from './components/PanelDock.vue'
import AssetDialog from './components/AssetDialog.vue'
import LayerEditor from './components/panels/LayerEditor.vue'
import LayerCreateDialog from './components/LayerCreateDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import LocationPickerDialog from './components/LocationPickerDialog.vue'
import WorkspacePanel from './components/panels/WorkspacePanel.vue'
import LayersPanel from './components/panels/LayersPanel.vue'
import ThemePanel from './components/panels/ThemePanel.vue'
import SettingsPanel from './components/panels/SettingsPanel.vue'
import LocationsPanel from './components/panels/LocationsPanel.vue'
import Icon from './components/Icon.vue'
import { useUiActions } from './composables/useUiActions'
import { useLayersModel, type LayerEntry } from './composables/useLayersModel'
import { useViewer } from './composables/useViewer'
import { useArchiveLoader } from './composables/useArchiveLoader'
import { useIconPicker } from './composables/useIconPicker'
import { useLayerEditor } from './composables/useLayerEditor'
import { useUrlState } from './composables/useUrlState'
import { buildScratchDataset } from './utils/scratchDataset'
import { createSolidImageData, createTransparentImageData } from './utils/imageFactory'
import { validateOverlayLayers } from './utils/legendValidation'

type LayerViewState = {
  zoom: number
  centerX: number
  centerY: number
}

const editorRoot = ref<HTMLElement | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
const isDockCollapsed = ref(false)
const isCompactViewport = ref(window.innerWidth < 800)
const activeDockPanel = ref<DockPanel>('workspace')
const dockNavItems: Array<{ id: DockPanel; label: string; icon: string }> = [
  { id: 'workspace', label: 'Workspace', icon: 'briefcase' },
  { id: 'layers', label: 'Layers', icon: 'layer-group' },
  { id: 'locations', label: 'Locations', icon: 'location-dot' },
  { id: 'theme', label: 'Theme', icon: 'palette' },
  { id: 'assets', label: 'Assets', icon: 'image' },
  { id: 'settings', label: 'Settings', icon: 'sliders' }
]
const triggerFileSelect = () => viewerShell.value?.triggerFileSelect?.()

const projectStore = createProjectStore()
const layerBrowserStore = createLayerBrowserStore()
const datasetRef = ref<TerrainDataset | null>(null)
const baseThemeRef = ref<TerrainThemeOverrides | undefined>(undefined)

const { localSettings, loadLocalSettings } = useLocalSettings()

const {
  handle,
  status,
  statusFaded,
  viewerLifecycleState,
  renderResolution,
  updateStatus,
  mountViewer,
  requestViewerRemount,
  disposeViewer,
  cleanup: cleanupViewer
} = useViewer({
  getViewerElement: () => viewerShell.value?.getViewerElement() ?? null,
  getMountContext: getViewerMountContext,
  renderScaleMode: computed(() => localSettings.renderScaleMode)
})

const {
  workspaceForm,
  projectSnapshot,
  layerState,
  createScratchLegend
} = useWorkspace({
  projectStore,
  layerBrowserStore,
  datasetRef,
  handle,
  viewerLifecycleState,
  persistCurrentProject,
  requestViewerRemount,
  localSettings,
  setActivePanel,
  ensureDockExpanded: () => {
    isDockCollapsed.value = false
  },
  updateStatus
})

const layersApi = useLayersModel({ layerState, handle })
const dockExpanded = computed(
  () => activeDockPanel.value === 'layers' && layersApi.layerEditorOpen.value
)
const hideDockNav = computed(() => !isDockCollapsed.value || dockExpanded.value)
const activeLayerViewState = ref<LayerViewState | null>(null)
const pendingLayerViewStateRoute = ref<{ id: string | null; state: LayerViewState | null }>({
  id: null,
  state: null
})
const pendingLayerSwitchViewState = ref<{ id: string; state: LayerViewState } | null>(null)
const pendingViewStateForEditor = computed(() => {
  const activeId = layersApi.activeLayer.value?.id ?? null
  if (!activeId) return null
  if (pendingLayerViewStateRoute.value.id === activeId) {
    return pendingLayerViewStateRoute.value.state
  }
  if (pendingLayerSwitchViewState.value?.id === activeId) {
    return pendingLayerSwitchViewState.value.state
  }
  return null
})
watch(
  () => layersApi.activeLayer.value?.id,
  (next) => {
    if (next && activeLayerViewState.value) {
      pendingLayerSwitchViewState.value = {
        id: next,
        state: activeLayerViewState.value
      }
    } else {
      pendingLayerSwitchViewState.value = null
    }
  }
)
function syncViewerPause() {
  const viewerHandle = handle.value
  const open = layersApi.layerEditorOpen.value
  if (viewerHandle) {
    viewerHandle.setMaxPixelRatio(open ? 1 : 1.5)
    viewerHandle.setRenderPaused(open)
  }
}

watch(
  [() => handle.value, () => layersApi.layerEditorOpen.value],
  ([, open]) => {
    syncViewerPause()
    if (!open) {
      pendingLayerSwitchViewState.value = null
    } else {
      const nextId = layersApi.activeLayer.value?.id ?? null
      if (nextId && activeLayerViewState.value) {
        pendingLayerSwitchViewState.value = {
          id: nextId,
          state: activeLayerViewState.value
        }
      }
    }
  },
  { immediate: true }
)

watch(
  () => viewerLifecycleState.value,
  () => {
    syncViewerPause()
  }
)
const resolvedLayerViewStateForUrl = computed(() => {
  if (pendingLayerViewStateRoute.value.id && pendingLayerViewStateRoute.value.state) {
    return pendingLayerViewStateRoute.value.state
  }
  return layersApi.layerEditorOpen.value ? activeLayerViewState.value : null
})
const onionLayerState = reactive<Record<string, boolean>>({})
const maskViewMode = ref<'grayscale' | 'color'>('grayscale')
const layerEditorPanelState = computed(() => ({
  leftCollapsed: localSettings.layerEditorLeftCollapsed,
  rightCollapsed: localSettings.layerEditorRightCollapsed,
  leftPinned: localSettings.layerEditorLeftPinned,
  rightPinned: localSettings.layerEditorRightPinned
}))
const layerEntriesWithOnion = computed(() =>
  Array.isArray(layersApi.layerEntries.value)
    ? layersApi.layerEntries.value.map(entry => ({
        ...entry,
        onionEnabled: onionLayerState[entry.id] ?? false
      }))
    : []
)
const onionLayersForEditor = computed(() => {
  const activeId = layersApi.activeLayer.value?.id
  return layerEntriesWithOnion.value
    .filter(entry => entry.onionEnabled && entry.id !== activeId && entry.mask)
    .map(entry => ({
      id: entry.id,
      mask: entry.mask,
      color: entry.color
    }))
})
function toggleOnionLayer(id: string) {
  onionLayerState[id] = !onionLayerState[id]
}
function setOnionLayerState(id: string, enabled: boolean) {
  onionLayerState[id] = enabled
}
function handleMaskViewChange(mode: 'grayscale' | 'color') {
  maskViewMode.value = mode
}

function updateLayerEditorPanelState(next: {
  leftCollapsed: boolean
  rightCollapsed: boolean
  leftPinned: boolean
  rightPinned: boolean
}) {
  localSettings.layerEditorLeftCollapsed = next.leftCollapsed
  localSettings.layerEditorRightCollapsed = next.rightCollapsed
  localSettings.layerEditorLeftPinned = next.leftPinned
  localSettings.layerEditorRightPinned = next.rightPinned
}
watch(
  () => (layersApi.layerEntries.value ?? []).map((entry) => entry.id),
  (ids) => {
    const allowed = new Set(ids)
    Object.keys(onionLayerState).forEach((key) => {
      if (!allowed.has(key)) {
        delete onionLayerState[key]
      }
    })
  },
  { immediate: true }
)

function handleLayerViewStateChange(payload: { id: string; state: LayerViewState }) {
  if (layersApi.activeLayer.value?.id === payload.id) {
    activeLayerViewState.value = payload.state
  }
}

function consumePendingLayerViewState() {
  const activeId = layersApi.activeLayer.value?.id ?? null
  if (activeId && pendingLayerViewStateRoute.value.id === activeId) {
    pendingLayerViewStateRoute.value = { id: null, state: null }
  }
  if (activeId && pendingLayerSwitchViewState.value?.id === activeId) {
    pendingLayerSwitchViewState.value = null
  }
}

function setPendingLayerViewState(payload: { id: string | null; state: LayerViewState | null }) {
  pendingLayerViewStateRoute.value = payload
}
const layerEditorAssets = computed(
  () =>
    ((projectSnapshot.value.files ?? []) as TerrainProjectFileEntry[]).map((entry) => ({
      ...entry
    }))
)

const {
  themeForm,
  scheduleThemeUpdate,
  cancelThemeUpdate,
  resetThemeForm
} = useTheme({
  projectSnapshot: computed(() => ({
    ...projectSnapshot.value,
    theme: projectSnapshot.value.theme as DeepPartial<TerrainTheme> | undefined
  })),
  projectStore,
  handle,
  persistCurrentProject
})

function handleSpriteStateInput(state: SpriteStateKey) {
  handleSpriteStateInputHelper(themeForm, state, scheduleThemeUpdate)
}

function resetSpriteState(state: SpriteStateKey) {
  resetSpriteStateHelper(themeForm, state, scheduleThemeUpdate)
}

function handleStemStateInput(state: StemStateKey) {
  handleStemStateInputHelper(themeForm, state, scheduleThemeUpdate)
}

function resetStemState(state: StemStateKey) {
  resetStemStateHelper(themeForm, state, scheduleThemeUpdate)
}
const locationsApi = useLocations()

const cameraOffsetTarget = computed(() => {
  if (isCompactViewport.value || isDockCollapsed.value) return 0
  return activeDockPanel.value === 'locations' ? -0.28 : 0
})

watch(
  [handle, cameraOffsetTarget, () => locationsApi.activeLocation.value?.id],
  ([viewerHandle, offset, focusId]) => {
    if (!viewerHandle) return
    viewerHandle.setCameraOffset(offset, offset !== 0 ? focusId : undefined)
  },
  { immediate: true }
)
const pendingCameraOverride = ref<LocationViewState | null>(null)

function applyCameraOverride(state: LocationViewState) {
  pendingCameraOverride.value = state
  locationsApi.applyCameraViewOverride(state)
  tryApplyCameraOverride()
}

function tryApplyCameraOverride() {
  const pending = pendingCameraOverride.value
  const viewerHandle = handle.value
  if (!pending || !viewerHandle) return
  const fallbackPixel = {
    x: workspaceForm.width / 2,
    y: workspaceForm.height / 2
  }
  viewerHandle.navigateTo({
    pixel: pending.targetPixel ?? fallbackPixel,
    view: pending,
    instant: true
  })
  pendingCameraOverride.value = null
}

useUrlState({
  activePanel: activeDockPanel,
  setActivePanel,
  isDockCollapsed,
  layerEditorOpen: layersApi.layerEditorOpen,
  layerEditorSelectedLayerId: layersApi.layerEditorSelectedLayerId,
  openLayerEditor,
  layerEntries: layerEntriesWithOnion,
  layerBrowserStore,
  cameraViewState: locationsApi.cameraViewState,
  setCameraViewState: applyCameraOverride,
  layerViewState: resolvedLayerViewStateForUrl,
  setPendingLayerViewState,
  setActiveLocation: locationsApi.setActiveLocationByNameOrId,
  selectedLocationId: locationsApi.selectedLocationId,
  setOnionState: setOnionLayerState,
  maskViewMode
})

watch(
  () => handle.value,
  (next) => {
    if (next) {
      tryApplyCameraOverride()
    }
  },
  { immediate: true }
)
const persistedProject = ref<PersistedProject | null>(null)
const hasActiveArchive = computed(
  () => Boolean(datasetRef.value) || Boolean(projectSnapshot?.value?.legend)
)

const {
  assetOverrides,
  assetDialogFilter,
  missingIconWarnings,
  projectAssets,
  clearAssetOverrides,
  resolveAssetReference,
  getIconPreview,
  refreshIconPreviewCache,
  importIconAsset: importIconAssetHelper,
  replaceAssetWithFile: replaceAssetWithFileHelper,
  removeAsset: removeAssetFromStore,
  disposeAssetPreviewUrls,
  normalizeAssetFileName,
  setAssetDialogFilter
} = useAssetLibrary({
  projectStore,
  projectSnapshot: computed(() => ({
    ...projectSnapshot.value,
    files: (projectSnapshot.value.files ?? []) as TerrainProjectFileEntry[]
  })),
  datasetRef,
  locationsList: locationsApi.locationsList,
  handle,
  commitLocations: locationsApi.commitLocations
})

const layerEditorHelpers = useLayerEditor({
  projectStore,
  layerBrowserStore,
  datasetRef,
  layerState,
  handle,
  persistCurrentProject,
  replaceAssetWithFile: replaceAssetWithFileHelper,
  requestViewerRemount
})
const layerCreateDialogOpen = ref(false)
let layerReorderTimeout: ReturnType<typeof setTimeout> | null = null

function openLayerCreateDialog() {
  layerCreateDialogOpen.value = true
}

function closeLayerCreateDialog() {
  layerCreateDialogOpen.value = false
}

const {
  iconPickerTarget,
  iconLibraryInputRef,
  pendingAssetReplacement,
  openIconPicker,
  closeIconPicker,
} = useIconPicker(setAssetDialogFilter)

const assetsPanelMode = ref<'default'>('default')
const thumbnailAssetPath = 'thumbnails/thumbnail.png'
const isCreatingThumbnail = ref(false)

const hasThumbnailAsset = computed(() =>
  projectAssets.value.some((asset) => asset.path === thumbnailAssetPath)
)
const thumbnailPreviewUrl = computed(() => getIconPreview(thumbnailAssetPath))

const assetsPanelSelectLabel = computed(() => {
  if (iconPickerTarget.value) return 'Use icon'
  if (modalAssetPicker.value?.mode === 'layer') return 'Use asset'
  if (modalAssetPicker.value?.mode === 'thumbnail') return 'Use thumbnail'
  return 'Use asset'
})

const modalAssetPicker = ref<{ mode: 'layer' | 'thumbnail'; layerId?: string } | null>(null)

function openAssetsPanel() {
  assetsPanelMode.value = 'default'
  setAssetDialogFilter('')
  iconPickerTarget.value = null
  setActivePanel('assets')
}

function openAssetsModalForLayer(payload: { id: string }) {
  modalAssetPicker.value = { mode: 'layer', layerId: payload.id }
  setAssetDialogFilter('')
}

function openAssetsModalForThumbnail() {
  modalAssetPicker.value = { mode: 'thumbnail' }
  setAssetDialogFilter('thumbnail')
}

function closeModalAssetPicker() {
  modalAssetPicker.value = null
  setAssetDialogFilter('')
}

const {
  loadArchiveFromBytes,
  loadArchiveFromFile: loadArchiveFromFileInternal,
  loadArchiveFromUrl,
  loadSampleArchive
} = useArchiveLoader({
  projectStore,
  layerBrowserStore,
  datasetRef,
  baseThemeRef,
  wrapDatasetWithOverrides,
  clearAssetOverrides,
  missingIconWarnings,
  refreshIconPreviewCache,
  updateStatus,
  setOverlayLoading,
  persistCurrentProject,
  mountViewer,
  disposeViewer,
  cleanupDataset,
  onBeforeLoad: locationsApi.resetPlacementState,
  getSampleArchiveUrl: archiveUrl
})

type DemoMapEntry = {
  id: string
  title: string
  description: string
  filename: string
  status: 'available' | 'planned'
  date: string
  thumbnail?: string | null
}

const sampleMaps = ref<DemoMapEntry[]>([])
const sampleMapId = ref<string | null>(null)

function getPublicMapUrl(filename: string) {
  return new URL(`../maps/${filename}`, window.location.href).toString()
}

async function loadSampleRegistry() {
  try {
    const response = await fetch(
      new URL('../maps/registry.json', window.location.href).toString()
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { maps?: DemoMapEntry[] }
    sampleMaps.value = data.maps ?? []
    const firstAvailable = sampleMaps.value.find((entry) => entry.status === 'available')
    sampleMapId.value = firstAvailable?.id ?? sampleMaps.value[0]?.id ?? null
  } catch (err) {
    console.warn('Failed to load sample map registry', err)
  }
}

async function loadSampleMapById(id?: string | null) {
  if (!sampleMaps.value.length) {
    await loadSampleRegistry()
  }
  const mapId = id ?? sampleMapId.value
  const entry = sampleMaps.value.find((item) => item.id === mapId)
  if (!entry || entry.status !== 'available') return
  await loadSampleArchive(getPublicMapUrl(entry.filename), entry.title)
}

const loadSample = () => loadSampleMapById()
const loadArchiveFromFile = loadArchiveFromFileInternal

type GlobalConfirmState = {
  message: string
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
}

const confirmState = ref<GlobalConfirmState | null>(null)
const { uiActions } = useUiActions({
  hasActiveArchive,
  setActivePanel,
  setDockExpanded: () => {
    isDockCollapsed.value = false
  },
  loadSample,
  triggerFileSelect: () => viewerShell.value?.triggerFileSelect(),
  startNewMap: () => {
    void startNewMap()
  },
  exportArchive,
  promptCloseArchive
})

function requestConfirm(
  message: string,
  onConfirm: () => void,
  options: { confirmLabel?: string; cancelLabel?: string; confirmVariant?: 'primary' | 'danger' } = {}
) {
  confirmState.value = { message, onConfirm, ...options }
}

function handleConfirmDialog() {
  const action = confirmState.value?.onConfirm
  confirmState.value = null
  action?.()
}

function dismissConfirmDialog() {
  confirmState.value = null
}

function handleResize() {
  isCompactViewport.value = window.innerWidth < 800
}

async function persistCurrentProject(options: { base64?: string; label?: string } = {}) {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  const next = await persistProjectSnapshot(snapshot, options)
  if (next) {
    persistedProject.value = next
    projectStore.markPersisted()
  }
}

function archiveUrl() {
  return new URL('../../maps/wynnal-terrain.wyn', import.meta.url).toString()
}

function cleanupDataset() {
  datasetRef.value?.cleanup?.()
  datasetRef.value = null
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  viewerShell.value?.setOverlayLoading(state)
}

function closeActiveArchive() {
  disposeViewer()
  cleanupDataset()
  layersApi.resetLayerEditor()
  layerBrowserStore.setLegend(undefined)
  projectStore.reset()
  layerState.value = layerBrowserStore.getLayerToggles()
  locationsApi.locationsList.value = []
  locationsApi.setActiveLocation(null)
  confirmState.value = null
  iconPickerTarget.value = null
  assetsPanelMode.value = 'default'
  locationsApi.locationsDragActive.value = false
  handle.value = null
  baseThemeRef.value = undefined
  activeDockPanel.value = 'workspace'
  locationsApi.closeLocationPicker()
  clearAssetOverrides()
  missingIconWarnings.clear()
  cancelThemeUpdate()
  refreshIconPreviewCache()
  updateStatus('Viewer cleared. Load a map to continue.')
  persistedProject.value = null
  setAutoRestoreEnabled(false)
  locationsApi.resetPlacementState()
}

function promptCloseArchive() {
  if (!hasActiveArchive.value) return
  requestConfirm('Unload the current map? Unsaved changes may be lost.', () => closeActiveArchive())
}

async function startNewMap() {
  closeActiveArchive()
  const scratchLegend = createScratchLegend()
  projectStore.setLegend(scratchLegend)
  layerBrowserStore.setLegend(scratchLegend)
  const scratchLayerState = layerBrowserStore.getLayerToggles()
  layerState.value = scratchLayerState
  const scratchDataset = buildScratchDataset(scratchLegend)
  scratchDataset.files.forEach((entry) => {
    projectStore.upsertFile(entry)
  })
  datasetRef.value = scratchDataset.dataset
  workspaceForm.width = scratchLegend.size[0]
  workspaceForm.height = scratchLegend.size[1]
  workspaceForm.seaLevel = scratchLegend.sea_level ?? 0
  workspaceForm.heightScale = scratchLegend.height_scale ?? 0.3
  setActivePanel('workspace')
  isDockCollapsed.value = false
  await mountViewer({
    dataset: scratchDataset.dataset,
    layerState: scratchLayerState,
    locations: getViewerLocations(),
    interactive: locationsApi.interactive.value,
    theme: projectSnapshot.value.theme as DeepPartial<TerrainTheme> | undefined,
    onLocationPick: locationsApi.handleLocationPick,
    onLocationClick: (locationId: string) => locationsApi.setActiveLocation(locationId)
  })
  updateStatus('New project ready. Import layers to begin editing.')
  persistedProject.value = null
  clearPersistedProject()
  setAutoRestoreEnabled(false)
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportArchive() {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  const overlayValidation = validateOverlayLayers(snapshot.legend, snapshot.files)
  if (overlayValidation.errors.length) {
    console.warn('Overlay validation errors:', overlayValidation)
    updateStatus('Fix overlay entries before exporting.')
    return
  }
  if (overlayValidation.warnings.length) {
    console.warn('Overlay validation warnings:', overlayValidation)
  }
  try {
    updateStatus('Building archive…')
    const blob = await buildWynArchive(snapshot)
    const label = snapshot.metadata.label ?? 'terrain'
    const filename = label.endsWith('.wyn') ? label : `${label}.wyn`
    downloadBlob(filename, blob)
    updateStatus('Archive exported.')
  } catch (err) {
    console.error(err)
    updateStatus('Failed to export archive.')
  }
}

function toggleLayer(id: string) {
  if (id === 'heightmap') return
  layerBrowserStore.toggleVisibility(id)
}

function setAllLayers(kind: 'biome' | 'overlay', visible: boolean) {
  layerBrowserStore.setAll(kind, visible)
}

function rgb(color: [number, number, number] | undefined) {
  const next = color ?? [255, 255, 255]
  return `rgb(${next[0]}, ${next[1]}, ${next[2]})`
}

async function toggleEditorFullscreen() {
  const root = editorRoot.value
  if (!root) return
  try {
    if (!document.fullscreenElement) {
      await root.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.warn('Failed to toggle fullscreen', err)
  }
}

async function restorePersistedProject(autoTrigger: boolean) {
  const saved = readPersistedProject()
  if (!saved) return
  persistedProject.value = saved
  const buffer = base64ToArrayBuffer(saved.archiveBase64)
  await loadArchiveFromBytes(buffer, saved.label, {
    persist: false,
    base64: saved.archiveBase64
  })
  if (!autoTrigger) {
    setAutoRestoreEnabled(true)
  }
  updateStatus(`${saved.label} restored from local storage.`, 4500)
}

function toggleDock() {
  isDockCollapsed.value = !isDockCollapsed.value
}

function setActivePanel(panel: DockPanel) {
  activeDockPanel.value = panel
}

function openLayerEditor(id: string) {
  activeDockPanel.value = 'layers'
  isDockCollapsed.value = false
  layersApi.openLayerEditor(id)
}

function handleLocationSelect(id: string) {
  locationsApi.setActiveLocation(id)
  locationsApi.closeLocationPicker()
}

function selectIconFromLibrary(path: string) {
  if (!iconPickerTarget.value) return
  const target = locationsApi.locationsList.value.find(
    (entry) => ensureLocationId(entry).id === iconPickerTarget.value
  )
  if (!target) return
  target.icon = path
  locationsApi.commitLocations()
  closeIconPicker()
}

function beginAssetReplacement(asset: TerrainProjectFileEntry) {
  triggerLibraryUpload({
    replacePath: asset.path,
    originalName: asset.sourceFileName ?? asset.path
  })
}

function triggerLibraryUpload(options?: { replacePath?: string; originalName?: string }) {
  if (options?.replacePath) {
    pendingAssetReplacement.value = {
      path: options.replacePath,
      originalName: options.originalName
    }
  } else {
    pendingAssetReplacement.value = null
  }
  iconLibraryInputRef.value?.click()
}

async function handleLibraryUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    input.value = ''
    return
  }
  const replacementTarget = pendingAssetReplacement.value
  pendingAssetReplacement.value = null
  const resetInput = () => {
    input.value = ''
  }
  if (replacementTarget) {
    const performReplacement = async () => {
      await replaceAssetWithFileHelper(replacementTarget.path, file)
      resetInput()
    }
    const existingLabel = replacementTarget.originalName ?? replacementTarget.path
    const existingName = normalizeAssetFileName(existingLabel)
    const incomingName = normalizeAssetFileName(file.name)
    if (existingName !== incomingName) {
      requestConfirm(`Replace ${existingLabel} with ${file.name}?`, () => {
        void performReplacement()
      })
      resetInput()
      return
    }
    await performReplacement()
    return
  }
  const defaultPath = buildIconPath(file.name)
  const importAsset = async () => {
    await importIconAssetHelper(file, iconPickerTarget.value ?? undefined, defaultPath)
    resetInput()
  }
  const existingAsset = projectAssets.value.find((asset) => asset.path === defaultPath)
  if (existingAsset) {
    const existingLabel = existingAsset.sourceFileName ?? existingAsset.path
    requestConfirm(`Uploading ${file.name} will replace ${existingLabel}. Continue?`, () => {
      void importAsset()
    })
    resetInput()
    return
  }
  await importAsset()
}

async function handleCreateLayer(payload: {
  label: string
  kind: 'biome' | 'overlay'
  color: [number, number, number]
  overlayMode: 'mask' | 'rgba'
}) {
  const snapshot = projectStore.getSnapshot()
  const legend = snapshot.legend
  if (!legend) {
    closeLayerCreateDialog()
    return
  }
  const baseLabel = payload.label?.trim() || 'New Layer'
  const groupKey = payload.kind === 'overlay' ? 'overlays' : 'biomes'
  const group = { ...(legend[groupKey] ?? {}) }
  let baseKey = normalizeAssetFileName(baseLabel).replace(/\.[^.]+$/, '')
  if (!baseKey) baseKey = `${payload.kind}-layer`
  let key = baseKey
  let counter = 1
  while (group[key]) {
    key = `${baseKey}-${counter++}`
  }
  const [width, height] = legend.size ?? [512, 512]
  let newLayer: Record<string, unknown>
  if (payload.kind === 'overlay' && payload.overlayMode === 'rgba') {
    const texturePath = buildLayerTexturePath(key)
    const image = createTransparentImageData(width, height)
    const file = new File([image.buffer], texturePath, { type: 'image/png' })
    await replaceAssetWithFileHelper(texturePath, file)
    newLayer = {
      label: baseLabel,
      rgba: texturePath
    }
  } else {
    const maskPath = buildLayerMaskPath(key)
    const image = createSolidImageData(width, height, 0)
    const file = new File([image.buffer], maskPath, { type: 'image/png' })
    await replaceAssetWithFileHelper(maskPath, file)
    newLayer = {
      label: baseLabel,
      mask: maskPath,
      rgb: payload.color
    }
  }
  const nextLegend = {
    ...legend,
    [groupKey]: {
      ...group,
      [key]: newLayer
    }
  }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  layerState.value = layerBrowserStore.getLayerToggles()
  if (datasetRef.value) {
    if (groupKey === 'overlays') {
      datasetRef.value.legend.overlays = { ...(datasetRef.value.legend.overlays ?? {}), [key]: newLayer }
    } else {
      datasetRef.value.legend.biomes = { ...(datasetRef.value.legend.biomes ?? {}), [key]: newLayer }
    }
  }
  await persistCurrentProject()
  requestViewerRemount()
  layersApi.openLayerEditor(`${payload.kind}:${key}`)
  closeLayerCreateDialog()
}

function handleLayerReorder(payload: { sourceId: string; targetId: string | null }) {
  const { sourceId, targetId } = payload
  if (!sourceId || sourceId === 'heightmap') return
  const [kind, key] = sourceId.split(':')
  if (!key || (kind !== 'biome' && kind !== 'overlay')) return
  if (targetId === sourceId) return
  const snapshot = projectStore.getSnapshot()
  const legend = snapshot.legend
  if (!legend) return
  const groupKey = kind === 'overlay' ? 'overlays' : 'biomes'
  const group = legend[groupKey]
  if (!group || !group[key]) return
  const targetKey = targetId && targetId !== 'heightmap' ? targetId.split(':')[1] ?? null : null
  if (targetKey && !group[targetKey]) return
  const keys = Object.keys(group)
  const sourceIndex = keys.indexOf(key)
  if (sourceIndex === -1) return
  keys.splice(sourceIndex, 1)
  if (targetKey) {
    const insertIndex = keys.indexOf(targetKey)
    keys.splice(insertIndex >= 0 ? insertIndex : keys.length, 0, key)
  } else {
    keys.push(key)
  }
  const reordered: typeof group = {} as typeof group
  keys.forEach((entryKey) => {
    reordered[entryKey] = group[entryKey]
  })
  const nextLegend = {
    ...legend,
    [groupKey]: reordered
  }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    datasetRef.value.legend[groupKey] = { ...reordered }
  }
  scheduleLayerReorderPersist()
}

function scheduleLayerReorderPersist() {
  if (layerReorderTimeout) {
    clearTimeout(layerReorderTimeout)
  }
  layerReorderTimeout = setTimeout(() => {
    requestViewerRemount()
    void persistCurrentProject()
    layerReorderTimeout = null
  }, 500)
}

function handleLayerDelete(layerId: string) {
  if (!layerId || layerId === 'heightmap') return
  const entry = layerEntriesWithOnion.value.find((layer) => layer.id === layerId)
  if (!entry || entry.kind === 'heightmap') return
  requestConfirm(
    `Delete the layer "${entry.label}"? This cannot be undone.`,
    () => deleteLayerEntry(entry),
    { confirmLabel: 'Delete layer', confirmVariant: 'danger' }
  )
}

async function deleteLayerEntry(entry: (typeof layerEntriesWithOnion.value)[number]) {
  const snapshot = projectStore.getSnapshot()
  const legend = snapshot.legend
  if (!legend) return
  const [kind, key] = entry.id.split(':')
  if (!key) return
  const groupKey = kind === 'overlay' ? 'overlays' : 'biomes'
  const group = { ...(legend[groupKey] ?? {}) }
  if (!group[key]) return
  delete group[key]
  const nextLegend = {
    ...legend,
    [groupKey]: group
  }
  const wasActiveLayer = layersApi.layerEditorSelectedLayerId.value === entry.id

  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    if (groupKey === 'overlays' && datasetRef.value.legend.overlays) {
      delete datasetRef.value.legend.overlays[key]
    } else if (groupKey === 'biomes' && datasetRef.value.legend.biomes) {
      delete datasetRef.value.legend.biomes[key]
    }
  }
  if (entry.mask) {
    removeAssetFromStore(entry.mask)
  }
  if (wasActiveLayer) {
    layersApi.resetLayerEditor()
  }
  await persistCurrentProject()
  requestViewerRemount()
}

async function importLocationIcon(location: TerrainLocation, file: File) {
  await importIconAssetHelper(file, ensureLocationId(location).id!)
}

function clearLocationIcon(location: TerrainLocation) {
  location.icon = undefined
  locationsApi.commitLocations()
}

function onLocationsDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types?.includes('Files')) return
  swallowDragEvent(event)
  locationsApi.locationsDragActive.value = true
}

function onLocationsDragLeave(event: DragEvent) {
  swallowDragEvent(event)
  const target = event.relatedTarget as HTMLElement | null
  if (!target || !event.currentTarget) {
    locationsApi.locationsDragActive.value = false
    return
  }
  const current = event.currentTarget as HTMLElement
  if (!current.contains(target)) {
    locationsApi.locationsDragActive.value = false
  }
}

async function onLocationsDrop(event: DragEvent) {
  swallowDragEvent(event)
  locationsApi.locationsDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !locationsApi.activeLocation.value) return
  await importLocationIcon(locationsApi.activeLocation.value, file)
}

function swallowDragEvent(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()
}

function handleWindowDragEvent(event: DragEvent) {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.closest('.ctw-viewer-host') || target.closest('.ctw-viewer-overlay'))
  ) {
    return
  }
  if (
    target &&
    (target.closest('.panel-dock') ||
      target.closest('.asset-dialog') ||
      target.closest('.confirm-dialog'))
  ) {
    return
  }
  swallowDragEvent(event)
}

function removeAsset(path: string) {
  requestConfirm(`Remove ${path}?`, () => {
    removeAssetFromStore(path)
    if (iconPickerTarget.value) {
      iconPickerTarget.value = null
    }
  })
}

function getViewerLocations(list = locationsApi.locationsList.value) {
  return list.map((location) => ({
    ...location,
    icon: resolveAssetReference(location.icon)
  }))
}

registerViewerLocationResolver(getViewerLocations)

import type { DeepPartial, TerrainTheme } from '@connected-web/terrain-editor'

type ViewerMountContext = {
  dataset: TerrainDataset
  layerState: LayerToggleState
  locations: ReturnType<typeof getViewerLocations>
  interactive: boolean
  theme?: DeepPartial<TerrainTheme>
  onLocationPick: (payload: { pixel: { x: number; y: number } }) => void
  onLocationClick: (locationId: string) => void
  initialCameraView?: LocationViewState
}

function getViewerMountContext(): ViewerMountContext | null {
  if (!datasetRef.value || !layerState.value) return null
  return {
    dataset: datasetRef.value,
    layerState: layerState.value,
    locations: getViewerLocations(),
    interactive: locationsApi.interactive.value,
    theme: projectSnapshot.value.theme as DeepPartial<TerrainTheme> | undefined,
    onLocationPick: locationsApi.handleLocationPick,
    onLocationClick: (locationId: string) => locationsApi.setActiveLocation(locationId),
    initialCameraView: locationsApi.cameraViewState.value
  }
}

async function replaceLayerAssetFromFile(entry: LayerEntry, file: File) {
  if (!entry.mask) return
  const data = await file.arrayBuffer()
  await layerEditorHelpers.replaceLayerAsset({
    path: entry.mask,
    data,
    type: file.type,
    lastModified: file.lastModified,
    sourceFileName: file.name
  })
}

async function handleCreateEmptyMask(payload: { id: string }) {
  const entry = layerEntriesWithOnion.value.find((layer) => layer.id === payload.id)
  const legend = projectSnapshot.value?.legend
  if (!entry?.mask || !legend?.size) return
  const [width, height] = legend.size
  const image = createSolidImageData(width, height, 0)
  const file = new File([image.buffer], entry.mask, { type: 'image/png' })
  await replaceLayerAssetFromFile(entry, file)
  await persistCurrentProject()
}

async function replaceThumbnailFromFile(file: File) {
  const normalized =
    file.name === 'thumbnail.png'
      ? file
      : new File([file], 'thumbnail.png', { type: file.type, lastModified: file.lastModified })
  await replaceAssetWithFileHelper(thumbnailAssetPath, normalized)
  await persistCurrentProject()
}

async function captureThumbnailFromView() {
  if (isCreatingThumbnail.value) return
  isCreatingThumbnail.value = true
  const viewerElement = viewerShell.value?.getViewerElement()
  const canvas = viewerElement?.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) {
    updateStatus('Unable to capture thumbnail from the viewer.', 2000)
    isCreatingThumbnail.value = false
    return
  }
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      const fallbackDataUrl = canvas.toDataURL('image/png')
      const fallbackBlob = await fetch(fallbackDataUrl).then((res) => res.blob()).catch(() => null)
      if (!fallbackBlob) {
        updateStatus('Unable to capture thumbnail from the viewer.', 2000)
        return
      }
      const scaledFallback = await scaleThumbnailBlob(fallbackBlob)
      const fallbackFile = new File([scaledFallback], 'thumbnail.png', { type: 'image/png', lastModified: Date.now() })
      await replaceThumbnailFromFile(fallbackFile)
      return
    }
    const scaledBlob = await scaleThumbnailBlob(blob)
    const file = new File([scaledBlob], 'thumbnail.png', { type: 'image/png', lastModified: Date.now() })
    await replaceThumbnailFromFile(file)
  } finally {
    isCreatingThumbnail.value = false
  }
}

async function scaleThumbnailBlob(blob: Blob) {
  const image = await createImageBitmap(blob).catch(() => null)
  if (!image) return blob
  const maxWidth = 320
  const maxHeight = 180
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
  const targetWidth = Math.max(1, Math.round(image.width * scale))
  const targetHeight = Math.max(1, Math.round(image.height * scale))
  if (targetWidth === image.width && targetHeight === image.height) {
    image.close?.()
    return blob
  }
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight
  const context = outputCanvas.getContext('2d')
  if (!context) {
    image.close?.()
    return blob
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight)
  image.close?.()
  const scaledBlob = await new Promise<Blob | null>((resolve) => outputCanvas.toBlob(resolve, 'image/png'))
  if (scaledBlob) return scaledBlob
  const fallbackDataUrl = outputCanvas.toDataURL('image/png')
  return fetch(fallbackDataUrl).then((res) => res.blob()).catch(() => blob)
}

function handleModalAssetUpload() {
  const picker = modalAssetPicker.value
  if (!picker) {
    triggerLibraryUpload()
    return
  }
  if (picker.mode === 'layer') {
    const entry = picker.layerId
      ? layerEntriesWithOnion.value.find((layer) => layer.id === picker.layerId)
      : null
    if (!entry?.mask) {
      triggerLibraryUpload()
      return
    }
    triggerLibraryUpload({ replacePath: entry.mask, originalName: entry.mask })
    return
  }
  if (picker.mode === 'thumbnail') {
    triggerLibraryUpload({ replacePath: thumbnailAssetPath, originalName: thumbnailAssetPath })
    return
  }
  triggerLibraryUpload()
}

function handleLayerFileReplace(payload: { id: string; file: File }) {
  const entry = layerEntriesWithOnion.value.find((layer) => layer.id === payload.id)
  if (!entry || !entry.mask) return
  requestConfirm(
    `Replace "${entry.label ?? entry.id}" with ${payload.file.name}?`,
    () => {
      void replaceLayerAssetFromFile(entry, payload.file)
    },
    { confirmLabel: 'Replace layer' }
  )
}

function handleAssetPanelSelect(path: string) {
  const picker = modalAssetPicker.value
  if (!picker) return
  const asset = projectAssets.value.find((item) => item.path === path)
  if (!asset?.data) return
  const file = new File([asset.data], asset.sourceFileName ?? asset.path, { type: asset.type ?? 'image/png' })
  if (picker.mode === 'layer') {
    const targetId = picker.layerId
    if (!targetId) return
    const entry = layerEntriesWithOnion.value.find((layer) => layer.id === targetId)
    if (!entry || !entry.mask) return
    requestConfirm(
      `Replace "${entry.label ?? entry.id}" with ${asset.sourceFileName ?? asset.path}?`,
      () => {
        void replaceLayerAssetFromFile(entry, file)
        closeModalAssetPicker()
      },
      { confirmLabel: 'Replace layer' }
    )
    return
  }
  if (picker.mode === 'thumbnail') {
    requestConfirm(
      `Replace the thumbnail with ${asset.sourceFileName ?? asset.path}?`,
      () => {
        void replaceThumbnailFromFile(file)
        closeModalAssetPicker()
      },
      { confirmLabel: 'Replace thumbnail' }
    )
  }
}

const handleLayerAssetReplace = layerEditorHelpers.replaceLayerAsset
const handleLayerColourUpdate = layerEditorHelpers.updateLayerColour
const handleLayerNameUpdate = layerEditorHelpers.updateLayerName

function wrapDatasetWithOverrides(dataset: TerrainDataset): TerrainDataset {
  const baseResolve = dataset.resolveAssetUrl.bind(dataset)
  const baseHeightMap = dataset.getHeightMapUrl.bind(dataset)
  const baseTopology = dataset.getTopologyMapUrl.bind(dataset)
  return {
    ...dataset,
    resolveAssetUrl: (path: string) => {
      if (assetOverrides.has(path)) {
        return assetOverrides.get(path)!
      }
      return baseResolve(path)
    },
    getHeightMapUrl: () => {
      const heightPath = dataset.legend.heightmap
      if (heightPath && assetOverrides.has(heightPath)) {
        return assetOverrides.get(heightPath)!
      }
      return baseHeightMap()
    },
    getTopologyMapUrl: () => {
      const topoPath = dataset.legend.topology ?? dataset.legend.heightmap
      if (topoPath && assetOverrides.has(topoPath)) {
        return assetOverrides.get(topoPath)!
      }
      return baseTopology()
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('dragover', handleWindowDragEvent, true)
  window.addEventListener('drop', handleWindowDragEvent, true)
  loadLocalSettings()
  void loadSampleRegistry()

  // Check for autoload parameter
  const params = new URLSearchParams(window.location.search)
  const autoload = params.get('autoload')
  const mapParam = params.get('map')
  const renderScaleParam = params.get('renderScale')

  if (renderScaleParam) {
    const normalized = renderScaleParam.toLowerCase()
    const allowed = ['auto', 'very-low', 'low', 'medium', 'high', 'max'] as const
    if (allowed.includes(normalized as (typeof allowed)[number])) {
      localSettings.renderScaleMode = normalized as (typeof allowed)[number]
    }
  }

  if (mapParam) {
    void loadSampleArchive(getPublicMapUrl(mapParam), mapParam)
    return
  }

  if (autoload === 'sample') {
    // Auto-load the sample map for demos/tests
    void loadSampleMapById()
    return
  }

  // Otherwise, check for persisted project
  const saved = readPersistedProject()
  if (saved) {
    persistedProject.value = saved
    if (shouldAutoRestoreProject()) {
      void restorePersistedProject(true)
    }
  }
})

onBeforeUnmount(() => {
  cleanupViewer()
  cleanupDataset()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('dragover', handleWindowDragEvent, true)
  window.removeEventListener('drop', handleWindowDragEvent, true)
  disposeAssetPreviewUrls()
  cancelThemeUpdate()
})
</script>
