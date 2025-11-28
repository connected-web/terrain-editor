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
          :locations-api="locationsApi"
          :get-icon-preview="getIconPreview"
          :has-legend="Boolean(projectSnapshot?.value?.legend)"
          :disable-camera-actions="!handle"
          @open-icon-picker="openIconPicker"
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
        v-if="locationsApi.locationPickerOpen.value"
        :locations="locationsApi.locationsList.value"
        :active-id="locationsApi.selectedLocationId.value || undefined"
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
import { ensureLocationId } from './utils/locations'
import { useAssetLibrary } from './composables/useAssetLibrary'
import { useLocalSettings } from './composables/useLocalSettings'
import { useWorkspace } from './composables/useWorkspace'
import { registerViewerLocationResolver, type DockPanel } from './models/workspace'
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
import { useLayerSync } from './composables/useLayerSync'
import { useViewer } from './composables/useViewer'
import { useArchiveLoader } from './composables/useArchiveLoader'
import type { UIAction } from './types/uiActions'

const editorRoot = ref<HTMLElement | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
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

const { localSettings, loadLocalSettings } = useLocalSettings()

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
  requestViewerRemount,
  localSettings,
  setActivePanel,
  ensureDockExpanded: () => {
    isDockCollapsed.value = false
  },
  updateStatus
})

useLayerSync({ layerState, handle })

const {
  themeForm,
  commitThemeOverrides,
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
const persistedProject = ref<PersistedProject | null>(null)
const hasActiveArchive = computed(
  () => Boolean(datasetRef.value) || Boolean(projectSnapshot?.value?.legend)
)

const {
  assetOverrides,
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
  normalizeAssetFileName
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
  onBeforeLoad: locationsApi.resetPlacementState,
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
  locationsApi.locationsList.value = []
  locationsApi.setActiveLocation(null)
  confirmState.value = null
  iconPickerTarget.value = null
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
  locationsApi.openLocationPicker()
}

function closeLocationPicker() {
  locationsApi.closeLocationPicker()
}

function handleLocationSelect(id: string) {
  locationsApi.setActiveLocation(id)
  closeLocationPicker()
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
    onLocationClick: (locationId: string) => locationsApi.setActiveLocation(locationId)
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
