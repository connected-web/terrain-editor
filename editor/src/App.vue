<template>
  <div class="editor-shell" ref="editorRoot">
    <header class="editor-header">
      <div class="editor-heading">
        <p class="editor-kicker">Connected Web</p>
        <h1>Terrain Editor</h1>
        <p class="editor-subtitle">Load, inspect, and export Wyn archives directly in your browser.</p>
      </div>
      <button
        type="button"
        class="pill-button"
        :disabled="!persistedProject"
        @click="handleRestoreClick"
      >
        <Icon icon="clock-rotate-left">Restore last project</Icon>
      </button>
    </header>
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
      <PanelDock :collapsed="isDockCollapsed" :mobile="isCompactViewport" @toggle="toggleDock">
        <template #nav>
          <button
            class="panel-dock__nav-button"
            :class="{ 'panel-dock__nav-button--active': activeDockPanel === 'workspace' }"
            type="button"
            @click="setActivePanel('workspace')"
          >
            <Icon icon="compass-drafting">Workspace</Icon>
          </button>
          <button
            class="panel-dock__nav-button"
            :class="{ 'panel-dock__nav-button--active': activeDockPanel === 'layers' }"
            type="button"
            :disabled="!hasActiveArchive"
            @click="setActivePanel('layers')"
          >
            <Icon icon="layer-group">Layers</Icon>
          </button>
        </template>

        <section v-if="activeDockPanel === 'workspace'" class="panel-card panel-card--placeholder">
          <header class="panel-card__header">
            <Icon icon="compass-drafting">Workspace</Icon>
          </header>
          <p v-if="hasActiveArchive">
            Viewing <strong>{{ projectSnapshot.metadata.label ?? 'Unnamed terrain' }}</strong>. Use the toolbar to export
            or close the archive. Collapse the dock for a pure viewer, or jump to “Layers” for visibility controls.
          </p>
          <p v-else>
            Load a <code>.wyn</code> archive to unlock tools. The dock collapses when you only want the viewer.
          </p>
        </section>

        <section v-else class="panel-card">
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
      </PanelDock>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  buildWynArchive,
  createLayerBrowserStore,
  createProjectStore,
  initTerrainViewer,
  type LayerBrowserState,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainHandle,
  type TerrainLocation,
  loadWynArchiveFromArrayBuffer,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import EditorViewer from './components/EditorViewer.vue'
import PanelDock from './components/PanelDock.vue'
import type { UIAction } from './types/uiActions'

const STORAGE_KEY = 'ctw-editor-project-v2'
const AUTO_RESTORE_KEY = 'ctw-editor-restore-enabled'

const editorRoot = ref<HTMLElement | null>(null)
const status = ref('Load a Wyn archive to begin.')
const interactive = ref(false)
const isDockCollapsed = ref(false)
const isCompactViewport = ref(window.innerWidth < 800)
const activeDockPanel = ref<'workspace' | 'layers'>('workspace')

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

const layerEntries = computed(() => layerBrowserState.value.entries)

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
        callback: () => closeActiveArchive()
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
        id: 'toggle-placement',
        icon: interactive.value ? 'hand' : 'crosshairs',
        label: interactive.value ? 'Disable placement' : 'Enable placement',
        slot: 'bottom-right',
        callback: () => toggleInteraction()
      }
    )
  }
  return actions
})

projectStore.subscribe((snapshot) => {
  projectSnapshot.value = snapshot
  locationsList.value = snapshot.locations ? [...snapshot.locations] : []
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

async function mountViewer() {
  const viewerElement = viewerShell.value?.getViewerElement()
  if (!viewerElement || !datasetRef.value || !layerState.value) return
  disposeViewer()
  handle.value = await initTerrainViewer(viewerElement, datasetRef.value, {
    layers: layerState.value,
    locations: locationsList.value,
    interactive: interactive.value,
    onLocationPick: (payload) => {
      updateStatus(`Picked pixel (${payload.pixel.x}, ${payload.pixel.y})`)
    }
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
  try {
    const archive = await loadWynArchiveFromArrayBuffer(buffer, { includeFiles: true })
    datasetRef.value = archive.dataset
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
  handle.value = null
  activeDockPanel.value = 'workspace'
  updateStatus('Viewer cleared. Load a map to continue.')
  try {
    localStorage.setItem(AUTO_RESTORE_KEY, '0')
  } catch (err) {
    console.warn('Failed to clear persistence flags', err)
  }
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

function setActivePanel(panel: 'workspace' | 'layers') {
  activeDockPanel.value = panel
}

function handleRestoreClick() {
  if (!persistedProject.value) return
  void restorePersistedProject(false)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
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
})
</script>
