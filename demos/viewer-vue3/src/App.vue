<template>
  <div class="viewer-app">
    <header>
      <p class="muted">Terrain Viewer Demo (Vue 3)</p>
      <h1>Load Wyn archives and explore interactive terrain.</h1>
      <p class="muted">
        This harness wraps the shared <code>initTerrainViewer</code> helper in a Vue component,
        exercising props, events, and reactive controls before we embed it inside the editor.
      </p>
    </header>

    <section class="viewer-layout">
      <div class="viewer-panel">
        <div ref="viewerSlotRef" class="viewer-root-slot">
          <div ref="viewerRef" class="viewer-root"></div>
        </div>
        <p class="status">{{ status }}</p>
      </div>

      <aside class="controls-panel">
        <div class="control-section">
          <div class="section-header">
            <h2>Layers</h2>
            <button class="text-button" @click="resetLayers" :disabled="!legend">Reset</button>
          </div>
          <div class="control-grid" v-if="legend && layerState">
            <label
              v-for="biomeKey in Object.keys(legend.biomes)"
              :key="`biome-${biomeKey}`"
              class="pill-toggle"
            >
              <input
                type="checkbox"
                :checked="layerState.biomes[biomeKey]"
                @change="toggleLayer('biomes', biomeKey)"
              />
              <span>{{ biomeKey.replace(/_/g, ' ') }}</span>
            </label>
            <label
              v-for="overlayKey in Object.keys(legend.overlays)"
              :key="`overlay-${overlayKey}`"
              class="pill-toggle"
            >
              <input
                type="checkbox"
                :checked="layerState.overlays[overlayKey]"
                @change="toggleLayer('overlays', overlayKey)"
              />
              <span>{{ overlayKey.replace(/_/g, ' ') }}</span>
            </label>
          </div>
          <p v-else class="muted">Loading legend data…</p>
        </div>

        <div class="control-section">
          <div class="section-header">
            <h2>Locations</h2>
            <span class="muted">{{ locations.length }} pins</span>
          </div>
          <div class="location-list">
            <button
              v-for="location in locations"
              :key="location.id"
              class="pill-button"
              @click="navigateToLocation(location)"
            >
              {{ location.name ?? location.id }}
            </button>
            <p v-if="!locations.length" class="muted">No pins available.</p>
          </div>
        </div>

      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  initTerrainViewer,
  loadWynArchive,
  loadWynArchiveFromFile,
  type LayerToggleState,
  type TerrainLegend,
  type TerrainLocation,
  type TerrainHandle,
  type LoadedWynFile,
  createTerrainViewerHost,
  type TerrainViewMode,
  type TerrainViewerHostHandle,
  createViewerOverlay,
  type ViewerOverlayHandle
} from '@connected-web/terrain-editor'

type LayerGroup = keyof LayerToggleState

const viewerRef = ref<HTMLElement | null>(null)
const viewerSlotRef = ref<HTMLElement | null>(null)
const status = ref('Initializing viewer…')
const legend = ref<TerrainLegend | null>(null)
const locations = ref<TerrainLocation[]>([])
const layerState = ref<LayerToggleState | null>(null)
const handle = ref<TerrainHandle | null>(null)
const interactive = ref(false)
const viewMode = ref<TerrainViewMode>('embed')
const hostHandle = ref<TerrainViewerHostHandle | null>(null)
const overlayHandle = ref<ViewerOverlayHandle | null>(null)
let activeArchive: LoadedWynFile | null = null

function archiveUrl() {
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
}

function createLayerState(meta: TerrainLegend): LayerToggleState {
  return {
    biomes: Object.fromEntries(Object.keys(meta.biomes).map((key) => [key, true])),
    overlays: Object.fromEntries(Object.keys(meta.overlays).map((key) => [key, true]))
  }
}

async function applyLayerState() {
  if (handle.value && layerState.value) {
    await handle.value.updateLayers(layerState.value)
  }
}

function toggleLayer(group: LayerGroup, key: string) {
  if (!layerState.value) return
  layerState.value[group][key] = !layerState.value[group][key]
  applyLayerState()
}

function resetLayers() {
  if (!legend.value) return
  layerState.value = createLayerState(legend.value)
  applyLayerState()
}

function navigateToLocation(location: TerrainLocation) {
  handle.value?.navigateTo({
    pixel: location.pixel,
    locationId: location.id,
    view: location.view
  })
}

function setInteractiveState(next: boolean) {
  interactive.value = next
  handle.value?.setInteractiveMode(next)
  overlayHandle.value?.setInteractionActive(next)
}

function toggleInteraction() {
  setInteractiveState(!interactive.value)
}

function updateStatus(message: string) {
  status.value = message
  overlayHandle.value?.setStatus(message)
}

async function loadArchive(source: { kind: 'default' } | { kind: 'file'; file: File }) {
  if (!viewerRef.value) return
  handle.value?.destroy()
  activeArchive?.dataset.cleanup?.()
  handle.value = null
  activeArchive = null

  updateStatus(source.kind === 'default' ? 'Downloading wynnal-terrain.wyn…' : `Loading ${source.file.name}…`)
  try {
    const archive =
      source.kind === 'default' ? await loadWynArchive(archiveUrl()) : await loadWynArchiveFromFile(source.file)
    activeArchive = archive
    legend.value = archive.legend
    layerState.value = createLayerState(archive.legend)
    locations.value = archive.locations ?? []
    handle.value = await initTerrainViewer(viewerRef.value, archive.dataset, {
      layers: layerState.value,
      locations: locations.value,
      interactive: interactive.value,
      onLocationHover: (id: any) => {
        if (!id) {
          updateStatus('Hovering terrain')
          return
        }
        const entry = locations.value.find((loc: { id: TerrainLocation['id'] }) => loc.id === id)
        updateStatus(entry ? `Hovering location: '${entry.name ?? entry.id}'` : `Hovering ${id}`)
      },
      onLocationPick: (payload: { pixel: { x: any; y: any } }) => {
        updateStatus(`Placement: (${payload.pixel.x}, ${payload.pixel.y})`)
      },
      onLocationClick: (id: any) => {
        const location = locations?.value?.find((entry: { id: TerrainLocation['id'] }) => entry.id === id)
        updateStatus(
          location ? `Focused location: '${location.name ?? location.id}'` : `Focused location: ${id}`
        )
        if (location) {
          navigateToLocation(location)
        }
      }
    })
    updateStatus('Terrain loaded. Use the controls to explore.')
  } catch (err) {
    console.error(err)
    updateStatus('Failed to load terrain archive.')
  }
}

onMounted(() => {
  if (!viewerRef.value || !viewerSlotRef.value) return
  overlayHandle.value = createViewerOverlay(viewerRef.value, {
    onFileSelected: (file) => loadArchive({ kind: 'file', file }),
    onToggleInteraction: () => toggleInteraction(),
    onRequestPopout: () => hostHandle.value?.openPopout(),
    onRequestFullscreen: () => hostHandle.value?.toggleFullscreen().catch((err) => console.warn(err))
  })
  overlayHandle.value?.setInteractionActive(interactive.value)

  hostHandle.value = createTerrainViewerHost({
    viewerElement: viewerRef.value,
    embedTarget: viewerSlotRef.value,
    title: 'Terrain Viewer',
    subtitle: 'Pop-out mode',
    onModeChange: (mode) => {
      viewMode.value = mode
      overlayHandle.value?.setPopoutEnabled(mode === 'embed')
      overlayHandle.value?.setFullscreenActive(mode === 'fullscreen')
    }
  })

  loadArchive({ kind: 'default' })
})

onBeforeUnmount(() => {
  handle.value?.destroy()
  hostHandle.value?.destroy()
  overlayHandle.value?.destroy()
})

function openPopout() {
  hostHandle.value?.openPopout()
}
</script>
