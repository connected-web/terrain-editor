<template>
  <div class="editor-shell" ref="editorRoot">
    <EditorViewer
      ref="viewerShell"
      class="viewer-surface"
      :status="status"
      :interactive="interactive"
      :show-primary-actions="!hasActiveArchive"
      @load-file="loadArchiveFromFile"
      @load-sample="loadSample"
      @new-map="startNewMap"
      @toggle-interaction="toggleInteraction"
      @toggle-fullscreen="toggleEditorFullscreen"
    />

    <div class="panel-stack">
      <article class="panel-card">
        <div class="card-header">
          <h2>Legend JSON</h2>
          <div class="card-actions">
            <button class="text-button" @click="applyLegend" :disabled="!legendJson">Apply</button>
            <button class="text-button" @click="exportLegend" :disabled="!legendJson">
              Export
            </button>
            <button class="text-button" @click="exportArchive" :disabled="!hasActiveArchive">
              Export WYN
            </button>
          </div>
        </div>
        <textarea v-model="legendJson" spellcheck="false" />
      </article>

      <article class="panel-card">
        <div class="card-header">
          <h2>Locations JSON</h2>
          <div class="card-actions">
            <button class="text-button" @click="applyLocations" :disabled="!locationsJson">
              Apply
            </button>
            <button class="text-button" @click="exportLocations" :disabled="!locationsJson">
              Export
            </button>
          </div>
        </div>
        <textarea v-model="locationsJson" spellcheck="false" />
      </article>

      <p v-if="isPanelHidden" class="panel-warning">
        Expand the editor window (≥ 800 wide) to use the full editor features.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  buildWynArchive,
  createLayerBrowserStore,
  createProjectStore,
  initTerrainViewer,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainLegend,
  type TerrainLocation,
  type TerrainHandle,
  loadWynArchiveFromArrayBuffer,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import EditorViewer from './components/EditorViewer.vue'

const editorRoot = ref<HTMLElement | null>(null)
const status = ref('Load a Wyn archive to begin.')
const legendJson = ref('')
const locationsJson = ref('')
const interactive = ref(false)
const busy = ref(false)

const projectStore = createProjectStore()
const projectSnapshot = ref(projectStore.getSnapshot())
const layerBrowserStore = createLayerBrowserStore()
const layerState = ref<LayerToggleState | null>(layerBrowserStore.getLayerToggles())
const datasetRef = ref<TerrainDataset | null>(null)
const locationsList = ref<TerrainLocation[]>([])
const handle = ref<TerrainHandle | null>(null)
const persistedProject = ref<PersistedProject | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
const hasActiveArchive = computed(() => Boolean(datasetRef.value))
const isPanelHidden = ref(window.innerWidth < 800)

function handleResize() {
  isPanelHidden.value = window.innerWidth < 800
}

function updateStatus(message: string) {
  status.value = message
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  viewerShell.value?.setOverlayLoading(state)
}

projectStore.subscribe((snapshot) => {
  projectSnapshot.value = snapshot
  legendJson.value = snapshot.legend ? JSON.stringify(snapshot.legend, null, 2) : ''
  locationsJson.value = snapshot.locations ? JSON.stringify(snapshot.locations, null, 2) : ''
  locationsList.value = snapshot.locations ? [...snapshot.locations] : []
})

layerBrowserStore.subscribe(() => {
  layerState.value = layerBrowserStore.getLayerToggles()
})

const STORAGE_KEY = 'ctw-editor-project-v2'

type PersistedProject = {
  label: string
  archiveBase64: string
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function persistCurrentProject(options: { base64?: string; label?: string } = {}) {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  const base64 =
    options.base64 ??
    arrayBufferToBase64(await (await buildWynArchive(snapshot)).arrayBuffer())
  const next: PersistedProject = {
    label: options.label ?? snapshot.metadata.label ?? 'Untitled terrain',
    archiveBase64: base64
  }
  persistedProject.value = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
  busy.value = true
  const loadingLabel = `Loading ${label}…`
  updateStatus(loadingLabel)
  setOverlayLoading({ label: loadingLabel, loadedBytes: 0 })
  disposeViewer()
  cleanupDataset()
  try {
    const archive = await loadWynArchiveFromArrayBuffer(buffer, { includeFiles: true })
    datasetRef.value = archive.dataset
    const legend = archive.legend
    layerBrowserStore.setLegend(legend)
    projectStore.loadFromArchive({
      legend,
      locations: archive.locations,
      theme: archive.dataset.theme,
      files: archive.files,
      metadata: { label }
    })

    await mountViewer()
    updateStatus(`${label} loaded.`)
    if (options.persist ?? true) {
      const base64 = options.base64 ?? arrayBufferToBase64(buffer)
      await persistCurrentProject({
        label,
        base64
      })
    }
  } catch (err) {
    console.error(err)
    updateStatus(`Failed to load ${label}.`)
  } finally {
    busy.value = false
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

function startNewMap() {
  disposeViewer()
  cleanupDataset()
  layerBrowserStore.setLegend(undefined)
  projectStore.reset()
  legendJson.value = ''
  locationsJson.value = ''
  locationsList.value = []
  handle.value = null
  persistedProject.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to reset persisted project', err)
  }
  updateStatus('Create a new project by loading or importing a map.')
}

async function applyLegend() {
  if (!datasetRef.value || !legendJson.value) return
  try {
    const parsed = JSON.parse(legendJson.value) as TerrainLegend
    datasetRef.value.legend = parsed
    layerBrowserStore.setLegend(parsed)
    await mountViewer()
    projectStore.setLegend(parsed)
    await persistCurrentProject()
    updateStatus('Legend applied.')
  } catch (err) {
    console.error(err)
    updateStatus('Invalid legend JSON.')
  }
}

async function applyLocations() {
  if (!handle.value || !locationsJson.value) return
  try {
    const parsed = JSON.parse(locationsJson.value) as TerrainLocation[]
    locationsList.value = parsed
    handle.value.updateLocations(parsed)
    projectStore.setLocations(parsed)
    await persistCurrentProject()
    updateStatus('Locations applied.')
  } catch (err) {
    console.error(err)
    updateStatus('Invalid locations JSON.')
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

function exportLegend() {
  if (!legendJson.value) return
  const blob = new Blob([legendJson.value], { type: 'application/json' })
  downloadBlob('legend.json', blob)
}

function exportLocations() {
  if (!locationsJson.value) return
  const blob = new Blob([locationsJson.value], { type: 'application/json' })
  downloadBlob('locations.json', blob)
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

async function restorePersistedProject() {
  const saved = readPersistedProject()
  if (!saved) return
  persistedProject.value = saved
  try {
    const buffer = base64ToArrayBuffer(saved.archiveBase64)
    await loadArchiveFromBytes(buffer, saved.label, {
      persist: false,
      base64: saved.archiveBase64
    })
    updateStatus(`${saved.label} restored from local storage.`)
  } catch (err) {
    console.warn('Failed to restore saved project', err)
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  void restorePersistedProject()
})

onBeforeUnmount(() => {
  disposeViewer()
  cleanupDataset()
  window.removeEventListener('resize', handleResize)
})
</script>
