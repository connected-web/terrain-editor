<template>
  <div class="editor-shell" ref="editorRoot">
    <div class="editor-layout">
      <EditorViewer
        ref="viewerShell"
        class="viewer-surface"
        :status="status"
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

        <section v-if="activeDockPanel === 'workspace'" class="panel-card">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="compass-drafting">Workspace</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="resetWorkspaceForm" :disabled="!hasActiveArchive">
              Reset
            </button>
          </header>
          <div class="workspace-form">
            <label class="workspace-form__field">
              <span>Project title</span>
              <input type="text" v-model="workspaceForm.label" @change="updateProjectLabel(workspaceForm.label)" />
            </label>
            <label class="workspace-form__field">
              <span>Author</span>
              <input type="text" v-model="workspaceForm.author" @change="updateProjectAuthor(workspaceForm.author)" />
            </label>
            <div class="workspace-form__split">
              <label class="workspace-form__field">
                <span>Map width (px)</span>
                <input
                  type="number"
                  min="1"
                  v-model.number="workspaceForm.width"
                  @change="applyMapSize"
                />
              </label>
              <label class="workspace-form__field">
                <span>Map height (px)</span>
                <input
                  type="number"
                  min="1"
                  v-model.number="workspaceForm.height"
                  @change="applyMapSize"
                />
              </label>
            </div>
            <label class="workspace-form__field">
              <span>Sea level</span>
              <div class="workspace-form__range">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  v-model.number="workspaceForm.seaLevel"
                  @input="applySeaLevel"
                />
                <input
                  type="number"
                  step="0.01"
                  v-model.number="workspaceForm.seaLevel"
                  @change="applySeaLevel"
                />
              </div>
            </label>
            <p class="workspace-form__hint">
              Map size is used when validating layer imports. Sea level adjusts how water layers are rendered.
            </p>
          </div>
        </section>

        <section v-else-if="activeDockPanel === 'layers'" class="panel-card">
          <header class="panel-card__header">
            <Icon icon="layer-group">Layers</Icon>
            <span class="panel-card__hint">Toggle biome + overlay visibility</span>
          </header>
          <div v-if="layerEntries.length" class="panel-card__list">
            <button
              v-for="entry in layerEntries"
              :key="entry.id"
              type="button"
              class="pill-button panel-card__pill"
              :class="{ 'panel-card__pill--inactive': !entry.visible }"
              @click="toggleLayer(entry.id)"
            >
              <span class="panel-card__pill-swatch" :style="{ backgroundColor: rgb(entry.color) }" />
              <span class="panel-card__pill-label">{{ entry.label }}</span>
            </button>
            <div class="panel-card__pill-actions">
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('biome', true)">
                Show all biomes
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('biome', false)">
                Hide all biomes
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('overlay', true)">
                Show overlays
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('overlay', false)">
                Hide overlays
              </button>
            </div>
          </div>
          <p v-else class="panel-card__placeholder">Legend data not loaded yet.</p>
        </section>

        <section v-else-if="activeDockPanel === 'theme'" class="panel-card panel-card--theme">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="palette">Theme</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="resetThemeForm" :disabled="!hasActiveArchive">
              Reset
            </button>
          </header>
          <div class="theme-form">
            <label class="theme-form__field">
              <span>Label text color</span>
              <input type="color" v-model="themeForm.textColor" @input="applyThemeForm" />
            </label>
            <label class="theme-form__field">
              <span>Label background</span>
              <input type="color" v-model="themeForm.backgroundColor" @input="applyThemeForm" />
            </label>
            <label class="theme-form__field">
              <span>Label border</span>
              <input type="color" v-model="themeForm.borderColor" @input="applyThemeForm" />
            </label>
            <div class="theme-form__split">
              <label class="theme-form__field">
                <span>Border thickness</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.25"
                  v-model.number="themeForm.borderThickness"
                  @input="applyThemeForm"
                />
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.25"
                  v-model.number="themeForm.borderThickness"
                  @change="applyThemeForm"
                />
              </label>
              <label class="theme-form__field">
                <span>Label opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.opacity"
                  @input="applyThemeForm"
                />
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.opacity"
                  @change="applyThemeForm"
                />
              </label>
            </div>
            <div class="theme-form__split">
              <label class="theme-form__field">
                <span>Stem color</span>
                <input type="color" v-model="themeForm.stemColor" @input="applyThemeForm" />
              </label>
              <label class="theme-form__field">
                <span>Stem opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.stemOpacity"
                  @input="applyThemeForm"
                />
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.stemOpacity"
                  @change="applyThemeForm"
                />
              </label>
            </div>
            <p class="theme-form__hint">
              Theme changes update marker sprites + stems immediately so you can preview styles before exporting.
            </p>
          </div>
        </section>

        <section v-else class="panel-card panel-card--locations">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="location-dot">Locations</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="addLocation" :disabled="!projectSnapshot.legend">
              <Icon icon="plus">Add location</Icon>
            </button>
          </header>
          <p v-if="!locationsList.length" class="panel-card__placeholder">
            No locations yet. Import a map with locations or add them manually.
          </p>
          <div v-else class="locations-panel__browser">
            <button
              v-for="location in locationsList"
              :key="location.id"
              type="button"
              class="pill-button panel-card__pill"
              :class="{ 'panel-card__pill--active': location.id === selectedLocationId }"
              @click="setActiveLocation(location.id!)"
            >
              <Icon icon="location-dot" />
              {{ location.name || location.id }}
            </button>
          </div>
          <div
            v-if="activeLocation"
            class="locations-panel"
            :class="{ 'drag-active': locationsDragActive }"
            @dragenter="onLocationsDragEnter"
            @dragover="onLocationsDragEnter"
            @dragleave="onLocationsDragLeave"
            @drop="onLocationsDrop"
          >
            <article class="locations-panel__item">
              <div class="locations-panel__preview">
                <div
                  class="locations-panel__icon"
                  :class="{ 'locations-panel__icon--ghost': activeLocation.showBorder === false }"
                  :style="{ backgroundImage: getIconPreview(activeLocation.icon) ? `url('${getIconPreview(activeLocation.icon)}')` : undefined }"
                >
                  <span v-if="!getIconPreview(activeLocation.icon)">{{ activeLocation.name?.[0] ?? '?' }}</span>
                </div>
                <div class="locations-panel__preview-actions">
                  <button type="button" class="pill-button" @click="openIconPicker(activeLocation)">
                    <Icon icon="images">Choose icon</Icon>
                  </button>
                  <button
                    type="button"
                    class="pill-button pill-button--ghost"
                    @click="clearLocationIcon(activeLocation)"
                    :disabled="!activeLocation.icon"
                  >
                    <Icon icon="ban">Clear icon</Icon>
                  </button>
                  <button type="button" class="pill-button pill-button--ghost" @click="startPlacement(activeLocation)">
                    <Icon icon="crosshairs">Pick on map</Icon>
                  </button>
                </div>
              </div>
              <label class="locations-panel__field">
                <span>Name</span>
                <input
                  type="text"
                  v-model="activeLocation.name"
                  @blur="commitLocations"
                  placeholder="Location name"
                />
              </label>
              <label class="locations-panel__field">
                <span>Icon reference</span>
                <input
                  type="text"
                  v-model="activeLocation.icon"
                  @blur="commitLocations"
                  placeholder="e.g. icons/castle.png"
                />
              </label>
              <div class="locations-panel__coords">
                <label>
                  <span>X</span>
                  <input
                    type="number"
                    min="0"
                    :max="workspaceForm.width"
                    v-model.number="activeLocation.pixel.x"
                    @change="clampLocationPixel(activeLocation)"
                  />
                </label>
                <label>
                  <span>Y</span>
                  <input
                    type="number"
                    min="0"
                    :max="workspaceForm.height"
                    v-model.number="activeLocation.pixel.y"
                    @change="clampLocationPixel(activeLocation)"
                  />
                </label>
              </div>
              <label class="locations-panel__toggle">
                <input type="checkbox" v-model="activeLocation.showBorder" @change="commitLocations" />
                <span>Show label border</span>
              </label>
              <button type="button" class="pill-button pill-button--danger" @click="confirmRemoveLocation(activeLocation)">
                <Icon icon="trash">Remove location</Icon>
              </button>
            </article>
          </div>
          <p v-else-if="locationsList.length" class="panel-card__placeholder">Select a location to edit.</p>
        </section>
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
        @select="selectIconFromLibrary"
        @upload="triggerLibraryUpload"
        @remove="removeAsset"
        @close="closeIconPicker"
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
  initTerrainViewer,
  loadWynArchiveFromArrayBuffer,
  resolveTerrainTheme,
  type LayerBrowserState,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainHandle,
  type TerrainLocation,
  type TerrainProjectFileEntry,
  type TerrainThemeOverrides,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import EditorViewer from './components/EditorViewer.vue'
import PanelDock from './components/PanelDock.vue'
import AssetDialog from './components/AssetDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import type { UIAction } from './types/uiActions'

const STORAGE_KEY = 'ctw-editor-project-v2'
const AUTO_RESTORE_KEY = 'ctw-editor-restore-enabled'

type DockPanel = 'workspace' | 'layers' | 'theme' | 'locations'

const editorRoot = ref<HTMLElement | null>(null)
const status = ref('Load a Wyn archive to begin.')
const interactive = ref(false)
const isDockCollapsed = ref(false)
const isCompactViewport = ref(window.innerWidth < 800)
const activeDockPanel = ref<DockPanel>('workspace')

const workspaceForm = reactive({
  label: '',
  author: '',
  width: 1024,
  height: 1536,
  seaLevel: 0
})

const themeForm = reactive({
  textColor: '#f2ede0',
  backgroundColor: '#0d1320',
  borderColor: '#f6e7c3',
  borderThickness: 1,
  opacity: 1,
  stemColor: '#f6e7c3',
  stemOpacity: 0.85
})

const projectStore = createProjectStore()
const projectSnapshot = ref(projectStore.getSnapshot())
const layerBrowserStore = createLayerBrowserStore()
const layerBrowserState = ref<LayerBrowserState>(layerBrowserStore.getState())
const layerState = ref<LayerToggleState | null>(layerBrowserStore.getLayerToggles())
const datasetRef = ref<TerrainDataset | null>(null)
const locationsList = ref<TerrainLocation[]>([])
const handle = ref<TerrainHandle | null>(null)
const persistedProject = ref<PersistedProject | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
const hasActiveArchive = computed(() => Boolean(datasetRef.value))

const projectAssets = computed(() => projectSnapshot.value.files ?? [])
const layerEntries = computed(() => layerBrowserState.value.entries)
const locationsDragActive = ref(false)
const assetOverrides = new Map<string, string>()
const iconPickerTarget = ref<string | null>(null)
const iconLibraryInputRef = ref<HTMLInputElement | null>(null)
const iconPreviewCache = reactive<Record<string, string>>({})
const iconPreviewOwnership = new Map<string, string>()
const baseThemeRef = ref<TerrainThemeOverrides | undefined>(undefined)
const selectedLocationId = ref<string | null>(null)
const pendingLocationId = ref<string | null>(null)
const confirmState = ref<{ message: string; onConfirm: () => void } | null>(null)
const activeLocation = computed(() =>
  locationsList.value.find((location) => ensureLocationId(location).id === selectedLocationId.value) ?? null)
let viewerRemountHandle: number | null = null

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

const uiActions = computed<UIAction[]>(() => {
  const actions: UIAction[] = []
  if (!hasActiveArchive.value) {
    actions.push(
      {
        id: 'load-sample',
        icon: 'mountain-sun',
        label: 'Load sample map',
        description: 'Preview the bundled Wynnal terrain archive.',
        callback: () => void loadSample()
      },
      {
        id: 'load-file',
        icon: 'folder-open',
        label: 'Load map',
        description: 'Select a local .wyn archive from disk.',
        callback: () => viewerShell.value?.triggerFileSelect()
      },
      {
        id: 'new-project',
        icon: 'file-circle-plus',
        label: 'New project',
        description: 'Start from an empty workspace.',
        callback: () => startNewMap()
      }
    )
  } else {
    actions.push(
      {
        id: 'workspace',
        icon: 'compass-drafting',
        label: 'Workspace',
        description: 'Jump to the workspace controls.',
        callback: () => {
          setActivePanel('workspace')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'layers',
        icon: 'layer-group',
        label: 'Layers',
        description: 'Jump to the layer controls.',
        callback: () => {
          setActivePanel('layers')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'theme',
        icon: 'palette',
        label: 'Theme',
        description: 'Edit label + marker styling.',
        callback: () => {
          setActivePanel('theme')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'locations',
        icon: 'location-dot',
        label: 'Locations',
        description: 'Edit location names + icons.',
        callback: () => {
          setActivePanel('locations')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'export',
        icon: 'file-export',
        label: 'Export WYN',
        description: 'Download the current project as a Wyn archive.',
        callback: () => void exportArchive()
      },
      {
        id: 'close',
        icon: 'circle-xmark',
        label: 'Close map',
        description: 'Unload the active archive without auto-restoring on refresh.',
        callback: () => promptCloseArchive()
      }
    )
  }
  return actions
})

projectStore.subscribe((snapshot) => {
  projectSnapshot.value = snapshot
  locationsList.value = snapshot.locations
    ? snapshot.locations.map((location) => {
        const copy = ensureLocationId({ ...location })
        if (copy.showBorder === undefined) copy.showBorder = true
        return copy
      })
    : []
  refreshIconPreviewCache()
  ensureActiveLocationSelection()
})

layerBrowserStore.subscribe((state) => {
  layerBrowserState.value = state
  layerState.value = layerBrowserStore.getLayerToggles()
})

watch(
  () => layerState.value,
  async (next) => {
    if (next && handle.value) {
      await handle.value.updateLayers(next)
    }
  }
)

watch(
  () => locationsList.value.map((location) => location.icon),
  () => refreshIconPreviewCache(),
  { deep: true }
)

watch(
  () => projectSnapshot.value,
  (snapshot) => {
    workspaceForm.label = snapshot.metadata.label ?? ''
    workspaceForm.author = snapshot.metadata.author ?? ''
    workspaceForm.width = snapshot.legend?.size?.[0] ?? 1024
    workspaceForm.height = snapshot.legend?.size?.[1] ?? 1536
    workspaceForm.seaLevel = snapshot.legend?.sea_level ?? 0
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

type PersistedProject = {
  label: string
  archiveBase64: string
}

function handleResize() {
  isCompactViewport.value = window.innerWidth < 800
}

function updateStatus(message: string) {
  status.value = message
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  viewerShell.value?.setOverlayLoading(state)
}

function resetWorkspaceForm() {
  workspaceForm.label = projectSnapshot.value.metadata.label ?? ''
  workspaceForm.author = projectSnapshot.value.metadata.author ?? ''
  workspaceForm.width = projectSnapshot.value.legend?.size?.[0] ?? 1024
  workspaceForm.height = projectSnapshot.value.legend?.size?.[1] ?? 1536
  workspaceForm.seaLevel = projectSnapshot.value.legend?.sea_level ?? 0
}

function syncThemeFormFromSnapshot(snapshot = projectSnapshot.value) {
  const resolved = resolveTerrainTheme(snapshot.theme)
  const sprite = resolved.locationMarkers.sprite
  const spriteDefault = sprite.states.default
  themeForm.textColor = spriteDefault.textColor
  themeForm.backgroundColor = spriteDefault.backgroundColor
  themeForm.borderColor = spriteDefault.borderColor
  themeForm.borderThickness = spriteDefault.borderThickness
  themeForm.opacity = spriteDefault.opacity
  const stemDefault = resolved.locationMarkers.stem.states.default
  themeForm.stemColor = stemDefault.color
  themeForm.stemOpacity = stemDefault.opacity
}

function updateProjectLabel(value: string) {
  projectStore.updateMetadata({ label: value })
  void persistCurrentProject()
}

function updateProjectAuthor(value: string) {
  projectStore.updateMetadata({ author: value })
  void persistCurrentProject()
}

function resetThemeForm() {
  if (!hasActiveArchive.value) return
  if (baseThemeRef.value) {
    projectStore.setTheme(cloneValue(baseThemeRef.value))
  } else {
    projectStore.setTheme(undefined)
  }
  syncThemeFormFromSnapshot()
  requestViewerRemount()
  void persistCurrentProject()
}

function applyThemeForm() {
  if (!hasActiveArchive.value) return
  const overrides: TerrainThemeOverrides = {
    locationMarkers: {
      sprite: {
        states: {
          default: {
            textColor: themeForm.textColor,
            backgroundColor: themeForm.backgroundColor,
            borderColor: themeForm.borderColor,
            borderThickness: themeForm.borderThickness,
            opacity: themeForm.opacity
          }
        }
      },
      stem: {
        states: {
          default: {
            color: themeForm.stemColor,
            opacity: themeForm.stemOpacity
          }
        }
      }
    }
  }
  projectStore.setTheme(overrides)
  requestViewerRemount()
  void persistCurrentProject()
}

function applyMapSize() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const width = Math.max(1, Math.floor(workspaceForm.width))
  const height = Math.max(1, Math.floor(workspaceForm.height))
  const nextLegend = { ...legend, size: [width, height] as [number, number] }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    datasetRef.value.legend = nextLegend
    requestViewerRemount()
  }
  void persistCurrentProject()
}

function applySeaLevel() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const seaLevel = clampNumber(Number(workspaceForm.seaLevel), -1, 1)
  workspaceForm.seaLevel = seaLevel
  const nextLegend = { ...legend, sea_level: seaLevel }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    datasetRef.value.legend = nextLegend
    requestViewerRemount()
  }
  void persistCurrentProject()
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function cloneValue<T>(value: T): T {
  return value ? (JSON.parse(JSON.stringify(value)) as T) : value
}

async function persistCurrentProject(options: { base64?: string; label?: string } = {}) {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  let base64 = options.base64
  if (!base64) {
    const blob = await buildWynArchive(snapshot)
    const buffer = await blob.arrayBuffer()
    base64 = arrayBufferToBase64(buffer)
  }
  const next: PersistedProject = {
    label: options.label ?? snapshot.metadata.label ?? 'Untitled terrain',
    archiveBase64: base64
  }
  persistedProject.value = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    localStorage.setItem(AUTO_RESTORE_KEY, '1')
  } catch (err) {
    console.warn('Failed to persist project', err)
  }
  projectStore.markPersisted()
}

function readPersistedProject(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedProject
  } catch (err) {
    console.warn('Failed to read persisted project', err)
    return null
  }
}

function shouldAutoRestoreProject() {
  return localStorage.getItem(AUTO_RESTORE_KEY) !== '0'
}

function archiveUrl() {
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
}

function disposeViewer() {
  handle.value?.destroy()
  handle.value = null
}

function cleanupDataset() {
  datasetRef.value?.cleanup?.()
  datasetRef.value = null
}

function requestViewerRemount() {
  if (!datasetRef.value) return
  if (viewerRemountHandle !== null) {
    window.clearTimeout(viewerRemountHandle)
  }
  viewerRemountHandle = window.setTimeout(() => {
    viewerRemountHandle = null
    void mountViewer()
  }, 80)
}

async function mountViewer() {
  const viewerElement = viewerShell.value?.getViewerElement()
  if (!viewerElement || !datasetRef.value || !layerState.value) return
  disposeViewer()
  handle.value = await initTerrainViewer(viewerElement, datasetRef.value, {
    layers: layerState.value,
    locations: getViewerLocations(),
    interactive: interactive.value,
    theme: projectSnapshot.value.theme,
    onLocationPick: (payload) => {
        if (pendingLocationId.value) {
          const target = locationsList.value.find((location) => location.id === pendingLocationId.value)
          if (target) {
            target.pixel = {
              x: clampNumber(Math.round(payload.pixel.x), 0, workspaceForm.width),
              y: clampNumber(Math.round(payload.pixel.y), 0, workspaceForm.height)
            }
            pendingLocationId.value = null
            interactive.value = false
            handle.value?.setInteractiveMode(false)
            commitLocations()
            setActiveLocation(target.id!)
            updateStatus(`Placed ${target.name ?? target.id} at (${target.pixel.x}, ${target.pixel.y}).`)
          }
        } else {
          updateStatus(`Picked pixel (${payload.pixel.x}, ${payload.pixel.y})`)
        }
    },
    onLocationClick: (locationId) => setActiveLocation(locationId)
  })
}

type LoadArchiveOptions = {
  persist?: boolean
  base64?: string
}

async function loadArchiveFromBytes(buffer: ArrayBuffer, label: string, options: LoadArchiveOptions = {}) {
  const loadingLabel = `Loading ${label}…`
  updateStatus(loadingLabel)
  setOverlayLoading({ label: loadingLabel, loadedBytes: 0 })
  disposeViewer()
  cleanupDataset()
  clearAssetOverrides()
  try {
    const archive = await loadWynArchiveFromArrayBuffer(buffer, { includeFiles: true })
    datasetRef.value = wrapDatasetWithOverrides(archive.dataset)
    baseThemeRef.value = cloneValue(archive.dataset.theme)
    layerBrowserStore.setLegend(archive.legend)
    projectStore.loadFromArchive({
      legend: archive.legend,
      locations: archive.locations,
      theme: archive.dataset.theme,
      files: archive.files,
      metadata: { label }
    })

    await mountViewer()
    updateStatus(`${label} loaded.`)
    if (options.persist ?? true) {
      const base64 = options.base64 ?? arrayBufferToBase64(buffer)
      await persistCurrentProject({ label, base64 })
    }
  } catch (err) {
    console.error(err)
    updateStatus(`Failed to load ${label}.`)
  } finally {
    setOverlayLoading(null)
    refreshIconPreviewCache()
  }
}

async function loadSample() {
  try {
    updateStatus('Downloading sample archive…')
    const response = await fetch(archiveUrl())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    await loadArchiveFromBytes(buffer, 'sample archive')
  } catch (err) {
    console.error(err)
    updateStatus('Failed to download sample archive.')
  }
}

async function loadArchiveFromFile(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    await loadArchiveFromBytes(buffer, file.name)
  } catch (err) {
    console.error(err)
    updateStatus(`Failed to load ${file.name}.`)
  }
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
  clearAssetOverrides()
  refreshIconPreviewCache()
  updateStatus('Viewer cleared. Load a map to continue.')
  try {
    localStorage.setItem(AUTO_RESTORE_KEY, '0')
  } catch (err) {
    console.warn('Failed to clear persistence flags', err)
  }
}

function promptCloseArchive() {
  if (!hasActiveArchive.value) return
  requestConfirm('Unload the current map? Unsaved changes may be lost.', () => closeActiveArchive())
}

function startNewMap() {
  closeActiveArchive()
  updateStatus('New project ready. Import layers to begin editing.')
  try {
    persistedProject.value = null
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(AUTO_RESTORE_KEY, '0')
  } catch (err) {
    console.warn('Failed to reset persisted project', err)
  }
}

function addLocation() {
  const legend = projectSnapshot.value.legend
  const width = legend?.size?.[0] ?? 1024
  const height = legend?.size?.[1] ?? 1536
  const next: TerrainLocation = ensureLocationId({
    id: '',
    name: 'New location',
    pixel: { x: Math.round(width / 2), y: Math.round(height / 2) },
    showBorder: true
  })
  locationsList.value = [...locationsList.value, next]
  commitLocations()
  setActivePanel('locations')
  isDockCollapsed.value = false
  setActiveLocation(next.id!)
  startPlacement(next)
}

function confirmRemoveLocation(location: TerrainLocation) {
  requestConfirm(`Remove ${location.name ?? 'this location'}?`, () => {
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
    downloadBlob(`${label}.wyn`, blob)
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

function toggleInteraction() {
  interactive.value = !interactive.value
  handle.value?.setInteractiveMode(interactive.value)
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
    localStorage.setItem(AUTO_RESTORE_KEY, '1')
  }
  updateStatus(`${saved.label} restored from local storage.`)
}

function toggleDock() {
  isDockCollapsed.value = !isDockCollapsed.value
}

function setActivePanel(panel: DockPanel) {
  activeDockPanel.value = panel
}

function setActiveLocation(id: string | null) {
  selectedLocationId.value = id
}

function ensureActiveLocationSelection() {
  if (!locationsList.value.length) {
    selectedLocationId.value = null
    return
  }
  const ensured = locationsList.value.map((location) => ensureLocationId(location))
  if (!selectedLocationId.value || !ensured.some((location) => location.id === selectedLocationId.value)) {
    selectedLocationId.value = ensured[0].id ?? null
  }
}

function startPlacement(location: TerrainLocation) {
  if (!handle.value) return
  const id = ensureLocationId(location).id!
  selectedLocationId.value = id
  pendingLocationId.value = id
  interactive.value = true
  handle.value.setInteractiveMode(true)
  updateStatus(`Click anywhere on the map to place ${location.name ?? 'this location'}.`)
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
  handle.value.navigateTo({ pixel, locationId: id })
}

function ensureLocationId(location: TerrainLocation): TerrainLocation {
  if (!location.id) {
    location.id = `loc-${Math.random().toString(36).slice(2, 10)}`
  }
  return location
}

function openIconPicker(location: TerrainLocation) {
  iconPickerTarget.value = ensureLocationId(location).id!
}

function closeIconPicker() {
  iconPickerTarget.value = null
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

function triggerLibraryUpload() {
  iconLibraryInputRef.value?.click()
}

async function handleLibraryUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await importIconAsset(file, iconPickerTarget.value ?? undefined)
  input.value = ''
}

async function importLocationIcon(location: TerrainLocation, file: File) {
  await importIconAsset(file, ensureLocationId(location).id!)
}

function commitLocations() {
  const cloned = locationsList.value.map((location) => {
    const copy = ensureLocationId({ ...location })
    if (copy.showBorder === undefined) copy.showBorder = true
    return copy
  })
  locationsList.value = cloned
  projectStore.setLocations(cloned)
  handle.value?.updateLocations(getViewerLocations(cloned), selectedLocationId.value ?? undefined)
  ensureActiveLocationSelection()
  void persistCurrentProject()
}

function clampLocationPixel(location: TerrainLocation) {
  const width = workspaceForm.width
  const height = workspaceForm.height
  location.pixel.x = clampNumber(location.pixel.x ?? 0, 0, width)
  location.pixel.y = clampNumber(location.pixel.y ?? 0, 0, height)
  commitLocations()
}

function clearLocationIcon(location: TerrainLocation) {
  location.icon = undefined
  commitLocations()
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeAssetFileName(name: string) {
  const trimmed = name.trim().toLowerCase()
  const segments = trimmed.split('.')
  const ext = segments.length > 1 ? segments.pop() ?? '' : ''
  const base = segments
    .join('.')
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  const safeExt = ext.replace(/[^a-z0-9]+/g, '')
  return safeExt ? `${base || 'asset'}.${safeExt}` : base || 'asset'
}

function buildIconPath(name: string) {
  return `icons/${normalizeAssetFileName(name)}`
}

function setAssetOverride(path: string, file: File) {
  const existing = assetOverrides.get(path)
  if (existing) {
    URL.revokeObjectURL(existing)
  }
  const url = URL.createObjectURL(file)
  assetOverrides.set(path, url)
  iconPreviewCache[path] = url
  iconPreviewOwnership.set(path, url)
}

function clearAssetOverrides() {
  assetOverrides.forEach((url) => URL.revokeObjectURL(url))
  assetOverrides.clear()
  refreshIconPreviewCache()
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

async function importIconAsset(file: File, targetLocationId?: string) {
  const path = buildIconPath(file.name)
  const buffer = await file.arrayBuffer()
  projectStore.upsertFile({
    path,
    data: buffer,
    type: file.type,
    lastModified: file.lastModified,
    sourceFileName: file.name
  })
  setAssetOverride(path, file)
  refreshIconPreviewCache()
  if (targetLocationId) {
    const target = locationsList.value.find(
      (location) => ensureLocationId(location).id === targetLocationId
    )
    if (target) {
      target.icon = path
      commitLocations()
    }
  }
  return path
}

function removeAsset(path: string) {
  requestConfirm(`Remove ${path}?`, () => {
    projectStore.removeFile(path)
    if (assetOverrides.has(path)) {
      const url = assetOverrides.get(path)
      if (url) URL.revokeObjectURL(url)
      assetOverrides.delete(path)
    }
    delete iconPreviewCache[path]
    locationsList.value = locationsList.value.map((location) =>
      location.icon === path ? { ...location, icon: undefined } : location
    )
    commitLocations()
    refreshIconPreviewCache()
    if (iconPickerTarget.value) {
      iconPickerTarget.value = null
    }
  })
}

function refreshIconPreviewCache() {
  const activePaths = new Set<string>()
  ;(projectSnapshot.value.files ?? []).forEach((file) => {
    activePaths.add(file.path)
    preloadIconPreview(file.path, file)
  })
  locationsList.value.forEach((location) => {
    if (location.icon) {
      activePaths.add(location.icon)
      preloadIconPreview(location.icon)
    }
  })
  Object.keys(iconPreviewCache).forEach((path) => {
    if (!activePaths.has(path) && !assetOverrides.has(path)) {
      const ownedUrl = iconPreviewOwnership.get(path)
      if (ownedUrl) {
        URL.revokeObjectURL(ownedUrl)
        iconPreviewOwnership.delete(path)
      }
      delete iconPreviewCache[path]
    }
  })
}

function getViewerLocations(list = locationsList.value) {
  return list.map((location) => ({
    ...location,
    icon: resolveAssetReference(location.icon)
  }))
}

function resolveAssetReference(reference?: string) {
  if (!reference) return undefined
  if (assetOverrides.has(reference)) return reference
  if (projectAssets.value.some((file) => file.path === reference)) return reference
  const alias = projectAssets.value.find(
    (file) => file.sourceFileName === reference || file.path.endsWith(`/${reference}`)
  )
  return alias?.path ?? reference
}

function getIconPreview(icon?: string) {
  const resolved = resolveAssetReference(icon)
  if (!resolved) return ''
  if (assetOverrides.has(resolved)) return assetOverrides.get(resolved)!
  if (iconPreviewCache[resolved]) return iconPreviewCache[resolved]
  preloadIconPreview(resolved)
  return ''
}

async function preloadIconPreview(path: string, file?: TerrainProjectFileEntry) {
  if (iconPreviewCache[path]) return
  if (assetOverrides.has(path)) {
    iconPreviewCache[path] = assetOverrides.get(path)!
    return
  }
  if (file) {
    const blob = new Blob([file.data], { type: file.type ?? 'image/png' })
    const url = URL.createObjectURL(blob)
    iconPreviewCache[path] = url
    iconPreviewOwnership.set(path, url)
    return
  }
  const dataset = datasetRef.value
  if (!dataset) return
  try {
    const resolved = await Promise.resolve(dataset.resolveAssetUrl(path))
    iconPreviewCache[path] = resolved
  } catch (err) {
    console.warn('Failed to resolve icon preview', path, err)
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
  const saved = readPersistedProject()
  if (saved) {
    persistedProject.value = saved
    if (shouldAutoRestoreProject()) {
      void restorePersistedProject(true)
    }
  }
})

onBeforeUnmount(() => {
  disposeViewer()
  cleanupDataset()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('dragover', handleWindowDragEvent, true)
  window.removeEventListener('drop', handleWindowDragEvent, true)
  iconPreviewOwnership.forEach((url) => URL.revokeObjectURL(url))
  iconPreviewOwnership.clear()
  if (viewerRemountHandle !== null) {
    window.clearTimeout(viewerRemountHandle)
    viewerRemountHandle = null
  }
})
</script>
