<template>
  <div class="editor-shell" ref="editorRoot">
    <h1 class="sr-only">Terrain Editor</h1>
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
        @toggle="toggleDock"
      >
        <WorkspacePanel
          v-if="activeDockPanel === 'workspace'"
          :has-active-archive="hasActiveArchive"
          @load-sample="loadSample"
          @load-map="triggerFileSelect"
          @export-archive="exportArchive"
        />

        <LayersPanel
          v-else-if="activeDockPanel === 'layers'"
          :layer-entries="layerEntries"
          :color-to-css="rgb"
          @toggle-layer="toggleLayer"
          @set-all="setAllLayers"
        />

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

        <SettingsPanel v-else-if="activeDockPanel === 'settings'" :local-settings="localSettings" />

        <LocationsPanel
          v-else
          :active-location="activeLocation"
          :locations-list="locationsList"
          :location-step-x="locationStepX"
          :location-step-y="locationStepY"
          :locations-drag-active="locationsDragActive"
          :get-icon-preview="getIconPreview"
          :has-legend="Boolean(projectSnapshot.legend)"
          :disable-camera-actions="!handle"
          @add-location="addLocation"
          @open-picker="openLocationPicker"
          @open-icon-picker="openIconPicker"
          @clear-icon="clearLocationIcon"
          @start-placement="startPlacement"
          @clamp-pixel="clampLocationPixel"
          @commit="commitLocations"
          @remove="confirmRemoveLocation"
          @drag-enter="onLocationsDragEnter"
          @drag-leave="onLocationsDragLeave"
          @drop="onLocationsDrop"
          @capture-camera="captureCameraViewForActiveLocation"
          @clear-camera="clearActiveLocationView"
          @update-camera="updateActiveLocationViewField"
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
        @update:filter-text="setAssetDialogFilter"
        @select="selectIconFromLibrary"
        @replace="beginAssetReplacement"
        @upload="() => triggerLibraryUpload()"
        @remove="removeAsset"
        @close="closeIconPicker"
      />
      <LocationPickerDialog
        v-if="locationPickerOpen"
        :locations="locationsList"
        :active-id="selectedLocationId || undefined"
        @select="handleLocationSelect"
        @close="closeLocationPicker"
      />
      <ConfirmDialog
        v-if="confirmState"
        :message="confirmState.message"
        @confirm="handleConfirmDialog"
        @cancel="dismissConfirmDialog"
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
  type MarkerStemGeometryShape,
  type LayerBrowserState,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainLocation,
  type TerrainProjectFileEntry,
  type TerrainThemeOverrides,
  type LocationViewState,
  type ViewerOverlayLoadingState
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
import { useTheme } from './composables/useTheme'
import { buildIconPath } from './utils/assets'
import { clampNumber, ensureLocationId, getPlacementStep, snapLocationValue } from './utils/locations'
import { useAssetLibrary } from './composables/useAssetLibrary'
import { useLocalSettings } from './composables/useLocalSettings'
import { useWorkspace } from './composables/useWorkspace'
import { registerViewerLocationResolver } from './models/workspace'
import { useLocations } from './composables/useLocations'
import EditorViewer from './components/EditorViewer.vue'
import PanelDock from './components/PanelDock.vue'
import AssetDialog from './components/AssetDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import LocationPickerDialog from './components/LocationPickerDialog.vue'
import WorkspacePanel from './components/panels/WorkspacePanel.vue'
import LayersPanel from './components/panels/LayersPanel.vue'
import ThemePanel from './components/panels/ThemePanel.vue'
import SettingsPanel from './components/panels/SettingsPanel.vue'
import LocationsPanel from './components/panels/LocationsPanel.vue'
import { useUiActions } from './composables/useUiActions'
import { useViewer } from './composables/useViewer'
import { useArchiveLoader } from './composables/useArchiveLoader'
import type { UIAction } from './types/uiActions'

type DockPanel = 'workspace' | 'layers' | 'theme' | 'locations' | 'settings'

const editorRoot = ref<HTMLElement | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
const interactive = ref(false)
const isDockCollapsed = ref(false)
const isCompactViewport = ref(window.innerWidth < 800)
const activeDockPanel = ref<DockPanel>('workspace')
const triggerFileSelect = () => viewerShell.value?.triggerFileSelect?.()

const projectStore = createProjectStore()
const layerBrowserStore = createLayerBrowserStore()
const datasetRef = ref<TerrainDataset | null>(null)
const baseThemeRef = ref<TerrainThemeOverrides | undefined>(undefined)

const {
  handle,
  status,
  statusFaded,
  updateStatus,
  mountViewer,
  requestViewerRemount,
  disposeViewer,
  cleanup: cleanupViewer
} = useViewer({
  getViewerElement: () => viewerShell.value?.getViewerElement() ?? null,
  getMountContext: getViewerMountContext
})

const {
  workspaceForm,
  projectSnapshot,
  layerBrowserState,
  layerState,
  createScratchLegend
} = useWorkspace({
  projectStore,
  layerBrowserStore,
  datasetRef,
  handle,
  persistCurrentProject,
  requestViewerRemount
})

const { localSettings, loadLocalSettings, persistSettings } = useLocalSettings()

const {
  themeForm,
  syncThemeFormFromSnapshot,
  commitThemeOverrides,
  scheduleThemeUpdate,
  cancelThemeUpdate,
  resetThemeForm
} = useTheme({
  projectSnapshot,
  projectStore,
  handle,
  persistCurrentProject,
  baseThemeRef
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
const {
  locationsList,
  selectedLocationId,
  locationPickerOpen,
  pendingLocationId,
  pendingLocationDraft,
  locationsDragActive,
  activeLocation,
  locationStepX,
  locationStepY,
  setActiveLocation: setActiveLocationBase,
  ensureActiveLocationSelection: ensureActiveLocationSelection,
  commitLocations: commitLocationsBase,
  clampLocationPixel: clampLocationPixelBase,
  setLocations
} = useLocations()
const commitLocations = commitLocationsBase
const clampLocationPixel = clampLocationPixelBase
const persistedProject = ref<PersistedProject | null>(null)
const hasActiveArchive = computed(() => Boolean(datasetRef.value) || Boolean(projectSnapshot.value.legend))

const {
  assetOverrides,
  iconPreviewCache,
  iconPreviewOwnership,
  missingIconWarnings,
  projectAssets,
  setAssetOverride,
  clearAssetOverrides,
  resolveAssetReference,
  getIconPreview,
  preloadIconPreview,
  refreshIconPreviewCache,
  importIconAsset: importIconAssetHelper,
  replaceAssetWithFile: replaceAssetWithFileHelper,
  removeAsset: removeAssetFromStore,
  disposeAssetPreviewUrls,
  normalizeAssetFileName
} = useAssetLibrary({
  projectStore,
  projectSnapshot,
  datasetRef,
  locationsList,
  handle,
  commitLocations
})

const {
  loadArchiveFromBytes,
  loadArchiveFromFile: loadArchiveFromFileInternal,
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
  onBeforeLoad: resetLocationPlacementState,
  getSampleArchiveUrl: archiveUrl
})

const loadSample = loadSampleArchive
const loadArchiveFromFile = loadArchiveFromFileInternal

const layerEntries = computed(() => layerBrowserState.value.entries)
const iconPickerTarget = ref<string | null>(null)
const assetDialogFilter = ref('')
function setAssetDialogFilter(value: string) {
  assetDialogFilter.value = value
}
const iconLibraryInputRef = ref<HTMLInputElement | null>(null)
const NEW_LOCATION_PLACEHOLDER = '__pending-location__'
const confirmState = ref<{ message: string; onConfirm: () => void } | null>(null)
const pendingAssetReplacement = ref<{ path: string; originalName?: string } | null>(null)
const { uiActions } = useUiActions({
  hasActiveArchive,
  setActivePanel,
  setDockExpanded: () => {
    isDockCollapsed.value = false
  },
  loadSample,
  triggerFileSelect: () => viewerShell.value?.triggerFileSelect(),
  startNewMap,
  exportArchive,
  promptCloseArchive
})

function requestConfirm(message: string, onConfirm: () => void) {
  confirmState.value = { message, onConfirm }
}

function handleConfirmDialog() {
  const action = confirmState.value?.onConfirm
  confirmState.value = null
  action?.()
}

function dismissConfirmDialog() {
  confirmState.value = null
}

watch(
  () => layerState.value,
  async (next) => {
    if (next && handle.value) {
      await handle.value.updateLayers(next)
    }
  }
)

watch(
  () => projectSnapshot.value,
  (snapshot) => {
    syncThemeFormFromSnapshot(snapshot)
  },
  { immediate: true }
)

watch(
  () => selectedLocationId.value,
  (id) => {
    if (id) {
      focusLocationInViewer(id)
    } else if (handle.value) {
      handle.value.updateLocations(getViewerLocations())
    }
  }
)

watch(
  () => locationsList.value.length,
  (count) => {
    if (count === 0) {
      locationPickerOpen.value = false
    }
  }
)

watch(
  () => ({
    cameraTracking: localSettings.cameraTracking,
    openLocationsOnSelect: localSettings.openLocationsOnSelect
  }),
  () => persistSettings()
)

watch(
  () => localSettings.cameraTracking,
  (enabled) => {
    if (enabled && selectedLocationId.value) {
      focusLocationInViewer(selectedLocationId.value)
    }
  }
)

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
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
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
  layerBrowserStore.setLegend(undefined)
  projectStore.reset()
  layerState.value = layerBrowserStore.getLayerToggles()
  locationsList.value = []
  selectedLocationId.value = null
  pendingLocationId.value = null
  confirmState.value = null
  iconPickerTarget.value = null
  locationsDragActive.value = false
  handle.value = null
  baseThemeRef.value = undefined
  activeDockPanel.value = 'workspace'
  interactive.value = false
  locationPickerOpen.value = false
  pendingLocationDraft.value = null
  pendingLocationId.value = null
  clearAssetOverrides()
  missingIconWarnings.clear()
  cancelThemeUpdate()
  refreshIconPreviewCache()
  updateStatus('Viewer cleared. Load a map to continue.')
  persistedProject.value = null
  setAutoRestoreEnabled(false)
}

function promptCloseArchive() {
  if (!hasActiveArchive.value) return
  requestConfirm('Unload the current map? Unsaved changes may be lost.', () => closeActiveArchive())
}

function startNewMap() {
  closeActiveArchive()
  const scratchLegend = createScratchLegend()
  projectStore.setLegend(scratchLegend)
  layerBrowserStore.setLegend(scratchLegend)
  workspaceForm.width = scratchLegend.size[0]
  workspaceForm.height = scratchLegend.size[1]
  workspaceForm.seaLevel = scratchLegend.sea_level ?? 0
  setActivePanel('workspace')
  isDockCollapsed.value = false
  updateStatus('New project ready. Import layers to begin editing.')
  persistedProject.value = null
  clearPersistedProject()
  setAutoRestoreEnabled(false)
}

function addLocation() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const draft: TerrainLocation = ensureLocationId({
    id: '',
    name: `New location ${locationsList.value.length + 1}`,
    pixel: { x: 0, y: 0 },
    showBorder: true
  })
  pendingLocationDraft.value = draft
  pendingLocationId.value = NEW_LOCATION_PLACEHOLDER
  selectedLocationId.value = null
  interactive.value = true
  handle.value?.setInteractiveMode(true)
  setActivePanel('locations')
  isDockCollapsed.value = false
  locationPickerOpen.value = false
  updateStatus('Click anywhere on the map to place the new location.')
}

function confirmRemoveLocation(location: TerrainLocation) {
  requestConfirm(`Remove location "${location.name ?? 'this location'}"?`, () => {
    locationsList.value = locationsList.value.filter((entry) => entry.id !== location.id)
    commitLocations()
    if (selectedLocationId.value === location.id) {
      setActiveLocation(locationsList.value[0]?.id ?? null)
    }
    if (pendingLocationId.value === location.id) {
      pendingLocationId.value = null
      interactive.value = false
      handle.value?.setInteractiveMode(false)
    }
  })
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
  layerBrowserStore.toggleVisibility(id)
}

function setAllLayers(kind: 'biome' | 'overlay', visible: boolean) {
  layerBrowserStore.setAll(kind, visible)
}

function rgb(color: [number, number, number]) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
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

function setActiveLocation(id: string | null, options: { fromViewer?: boolean } = {}) {
  setActiveLocationBase(id)
  if (id && options.fromViewer && localSettings.openLocationsOnSelect) {
    setActivePanel('locations')
    isDockCollapsed.value = false
  }
}

function startPlacement(location: TerrainLocation) {
  if (!handle.value) return
  pendingLocationDraft.value = null
  const id = ensureLocationId(location).id!
  selectedLocationId.value = id
  pendingLocationId.value = id
  interactive.value = true
  handle.value.setInteractiveMode(true)
  updateStatus(`Click anywhere on the map to place ${location.name ?? 'this location'}.`)
}

function resetLocationPlacementState() {
  pendingLocationDraft.value = null
  pendingLocationId.value = null
  interactive.value = false
  handle.value?.setInteractiveMode(false)
}

function focusLocationInViewer(id: string) {
  if (!handle.value) return
  const target = locationsList.value.find((location) => ensureLocationId(location).id === id)
  if (!target) return
  handle.value.updateLocations(getViewerLocations(), id)
  const pixel =
    target.pixel ?? {
      x: Math.round(workspaceForm.width / 2),
      y: Math.round(workspaceForm.height / 2)
    }
  const view = localSettings.cameraTracking ? target.view : undefined
  handle.value.navigateTo({ pixel, locationId: id, view })
}

function getFallbackViewState(): LocationViewState {
  return handle.value?.getViewState() ?? { distance: 1, polar: Math.PI / 3, azimuth: 0 }
}

function ensureLocationView(location: TerrainLocation): LocationViewState {
  if (!location.view) {
    location.view = { ...getFallbackViewState() }
  }
  return location.view
}

function updateActiveLocationViewField(key: keyof LocationViewState, rawValue: string | number) {
  const location = activeLocation.value
  if (!location) return
  if (rawValue === '' || rawValue === null) {
    location.view = undefined
    commitLocations()
    return
  }
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return
  const view = ensureLocationView(location)
  view[key] = parsed
  commitLocations()
}

function captureCameraViewForActiveLocation() {
  if (!handle.value || !activeLocation.value) return
  activeLocation.value.view = { ...handle.value.getViewState() }
  commitLocations()
  updateStatus(
    `Saved camera view for ${activeLocation.value.name ?? activeLocation.value.id}.`,
    1500
  )
}

function clearActiveLocationView() {
  if (!activeLocation.value || !activeLocation.value.view) return
  activeLocation.value.view = undefined
  commitLocations()
}

function openIconPicker(location: TerrainLocation) {
  setAssetDialogFilter('icon')
  iconPickerTarget.value = ensureLocationId(location).id!
}

function closeIconPicker() {
  iconPickerTarget.value = null
  setAssetDialogFilter('')
  pendingAssetReplacement.value = null
}

function openLocationPicker() {
  if (!locationsList.value.length) return
  locationPickerOpen.value = true
}

function closeLocationPicker() {
  locationPickerOpen.value = false
}

function handleLocationSelect(id: string) {
  setActiveLocation(id)
  closeLocationPicker()
}

function selectIconFromLibrary(path: string) {
  if (!iconPickerTarget.value) return
  const target = locationsList.value.find(
    (entry) => ensureLocationId(entry).id === iconPickerTarget.value
  )
  if (!target) return
  target.icon = path
  commitLocations()
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

async function importLocationIcon(location: TerrainLocation, file: File) {
  await importIconAssetHelper(file, ensureLocationId(location).id!)
}

function clearLocationIcon(location: TerrainLocation) {
  location.icon = undefined
  commitLocations()
}

function onLocationsDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types?.includes('Files')) return
  swallowDragEvent(event)
  locationsDragActive.value = true
}

function onLocationsDragLeave(event: DragEvent) {
  swallowDragEvent(event)
  const target = event.relatedTarget as HTMLElement | null
  if (!target || !event.currentTarget) {
    locationsDragActive.value = false
    return
  }
  const current = event.currentTarget as HTMLElement
  if (!current.contains(target)) {
    locationsDragActive.value = false
  }
}

async function onLocationsDrop(event: DragEvent) {
  swallowDragEvent(event)
  locationsDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !activeLocation.value) return
  await importLocationIcon(activeLocation.value, file)
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

function getViewerLocations(list = locationsList.value) {
  return list.map((location) => ({
    ...location,
    icon: resolveAssetReference(location.icon)
  }))
}

registerViewerLocationResolver(getViewerLocations)

function handleViewerLocationPick(payload: { pixel: { x: number; y: number } }) {
  const snapped = {
    x: snapLocationValue(clampNumber(payload.pixel.x, 0, workspaceForm.width), workspaceForm.width),
    y: snapLocationValue(clampNumber(payload.pixel.y, 0, workspaceForm.height), workspaceForm.height)
  }
  if (pendingLocationId.value === NEW_LOCATION_PLACEHOLDER && pendingLocationDraft.value) {
    const draft = ensureLocationId({ ...pendingLocationDraft.value, pixel: snapped })
    pendingLocationDraft.value = null
    pendingLocationId.value = null
    interactive.value = false
    handle.value?.setInteractiveMode(false)
    locationsList.value = [...locationsList.value, draft]
    commitLocations()
    setActiveLocation(draft.id!)
    updateStatus(`Added ${draft.name ?? draft.id} at (${draft.pixel.x}, ${draft.pixel.y}).`)
    return
  }
  if (pendingLocationId.value) {
    const target = locationsList.value.find((location) => location.id === pendingLocationId.value)
    if (target) {
      target.pixel = snapped
      pendingLocationId.value = null
      interactive.value = false
      handle.value?.setInteractiveMode(false)
      commitLocations()
      setActiveLocation(target.id!)
      updateStatus(`Placed ${target.name ?? target.id} at (${target.pixel.x}, ${target.pixel.y}).`)
      return
    }
  }
  updateStatus(`Picked pixel (${snapped.x}, ${snapped.y})`)
}

function getViewerMountContext() {
  if (!datasetRef.value || !layerState.value) return null
  return {
    dataset: datasetRef.value,
    layerState: layerState.value,
    locations: getViewerLocations(),
    interactive: interactive.value,
    theme: projectSnapshot.value.theme,
    onLocationPick: handleViewerLocationPick,
    onLocationClick: (locationId: string) => setActiveLocation(locationId, { fromViewer: true })
  }
}

function wrapDatasetWithOverrides(dataset: TerrainDataset): TerrainDataset {
  const baseResolve = dataset.resolveAssetUrl.bind(dataset)
  return {
    ...dataset,
    resolveAssetUrl: (path: string) => {
      if (assetOverrides.has(path)) {
        return assetOverrides.get(path)!
      }
      return baseResolve(path)
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('dragover', handleWindowDragEvent, true)
  window.addEventListener('drop', handleWindowDragEvent, true)
  loadLocalSettings()
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
