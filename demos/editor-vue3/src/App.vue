<template>
  <div class="editor-demo">
    <header class="hero">
      <p class="muted">Editor Demo (Vue 3)</p>
      <h1>Inspect and tweak Wyn archives in a browser-first workflow.</h1>
      <p class="muted">
        Load a Wyn file from disk or use the sample map, preview it inside the Three.js viewer, and
        experiment with updating metadata or locations before exporting JSON back out.
      </p>
      <div class="cta-row">
        <input ref="fileInput" type="file" accept=".wyn" @change="onFileSelected" />
        <button class="button primary" @click="loadSample" :disabled="busy">
          Load sample archive
        </button>
      </div>
    </header>

    <section class="workspace">
      <div class="viewer-panel">
        <div ref="viewerRef" class="viewer-root"></div>
        <div class="status-bar">
          <span>{{ status }}</span>
          <span class="spacer"></span>
          <button class="text-button" @click="toggleInteraction" :disabled="!handle">
            {{ interactive ? 'Disable placement' : 'Enable placement' }}
          </button>
        </div>
      </div>

      <aside class="editor-panel">
        <article class="card">
          <div class="card-header">
            <h2>Legend JSON</h2>
            <div class="card-actions">
              <button class="text-button" @click="applyLegend" :disabled="!legendJson">Apply</button>
              <button class="text-button" @click="exportLegend" :disabled="!legendJson">
                Export
              </button>
            </div>
          </div>
          <textarea v-model="legendJson" spellcheck="false" />
        </article>

        <article class="card">
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
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import {
  initTerrainViewer,
  loadWynArchive,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainLegend,
  type TerrainLocation,
  type TerrainHandle
} from '@connected-web/terrain-editor'

const viewerRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const status = ref('Load a Wyn archive to begin.')
const legendJson = ref('')
const locationsJson = ref('')
const interactive = ref(false)
const busy = ref(false)

const layerState = ref<LayerToggleState | null>(null)
const datasetRef = ref<TerrainDataset | null>(null)
const locationsList = ref<TerrainLocation[]>([])
const handle = ref<TerrainHandle | null>(null)

const archiveUrl = () => new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()

const disposeViewer = () => {
  handle.value?.destroy()
  handle.value = null
}

const cleanupDataset = () => {
  datasetRef.value?.cleanup?.()
  datasetRef.value = null
}

const createLayerState = (legend: TerrainLegend): LayerToggleState => ({
  biomes: Object.fromEntries(Object.keys(legend.biomes).map((key) => [key, true])),
  overlays: Object.fromEntries(Object.keys(legend.overlays).map((key) => [key, true]))
})

const mountViewer = async () => {
  if (!viewerRef.value || !datasetRef.value || !layerState.value) return
  disposeViewer()
  handle.value = await initTerrainViewer(viewerRef.value, datasetRef.value, {
    layers: layerState.value,
    locations: locationsList.value,
    interactive: interactive.value,
    onLocationPick: (payload) => {
      status.value = `Picked pixel (${payload.pixel.x}, ${payload.pixel.y})`
    }
  })
}

const loadArchive = async (url: string, label: string) => {
  busy.value = true
  status.value = `Loading ${label}…`
  disposeViewer()
  cleanupDataset()
  try {
    const { dataset, legend, locations } = await loadWynArchive(url)
    datasetRef.value = dataset
    layerState.value = createLayerState(legend)
    legendJson.value = JSON.stringify(legend, null, 2)
    locationsList.value = locations ?? []
    locationsJson.value = JSON.stringify(locationsList.value, null, 2)
    await mountViewer()
    status.value = `${label} loaded.`
  } catch (err) {
    console.error(err)
    status.value = `Failed to load ${label}.`
  } finally {
    busy.value = false
  }
}

const loadSample = async () => {
  await loadArchive(archiveUrl(), 'sample archive')
}

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]
  const url = URL.createObjectURL(file)
  await loadArchive(url, file.name)
  URL.revokeObjectURL(url)
  input.value = ''
}

const applyLegend = async () => {
  if (!datasetRef.value || !legendJson.value) return
  try {
    const parsed = JSON.parse(legendJson.value) as TerrainLegend
    datasetRef.value.legend = parsed
    layerState.value = createLayerState(parsed)
    await mountViewer()
    status.value = 'Legend applied.'
  } catch (err) {
    console.error(err)
    status.value = 'Invalid legend JSON.'
  }
}

const applyLocations = () => {
  if (!handle.value || !locationsJson.value) return
  try {
    const parsed = JSON.parse(locationsJson.value) as TerrainLocation[]
    locationsList.value = parsed
    handle.value.updateLocations(parsed)
    status.value = 'Locations applied.'
  } catch (err) {
    console.error(err)
    status.value = 'Invalid locations JSON.'
  }
}

const downloadText = (filename: string, contents: string) => {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const exportLegend = () => {
  if (!legendJson.value) return
  downloadText('legend.json', legendJson.value)
}

const exportLocations = () => {
  if (!locationsJson.value) return
  downloadText('locations.json', locationsJson.value)
}

const toggleInteraction = () => {
  interactive.value = !interactive.value
  handle.value?.setInteractiveMode(interactive.value)
}

onBeforeUnmount(() => {
  disposeViewer()
  cleanupDataset()
})
</script>
