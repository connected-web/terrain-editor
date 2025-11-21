import './style.css'

import {
  initTerrainViewer,
  type LayerToggleState,
  type TerrainLegend,
  type TerrainLocation,
  type TerrainHandle,
  type LoadedWynFile,
  loadWynArchive,
  loadWynArchiveFromFile,
  createTerrainViewerHost,
  type TerrainViewerHostHandle,
  createViewerOverlay,
  type ViewerOverlayHandle
} from '@connected-web/terrain-editor'

const viewerEl = document.getElementById('viewer-root') as HTMLElement
const embedSlot = document.getElementById('viewer-embed-slot') as HTMLElement
const layerControlsEl = document.getElementById('layer-controls') as HTMLElement
const locationListEl = document.getElementById('location-list') as HTMLElement

function resolveArchivePath() {
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
}

function createDefaultLayerState(legend: TerrainLegend): LayerToggleState {
  return {
    biomes: Object.fromEntries(Object.keys(legend.biomes).map((key) => [key, true])),
    overlays: Object.fromEntries(Object.keys(legend.overlays).map((key) => [key, true]))
  }
}

console.log('Here')

function renderLayerControls(
  legend: TerrainLegend,
  state: LayerToggleState,
  onChange: () => void
) {
  layerControlsEl.innerHTML = ''
  function makeCheckbox(group: 'biomes' | 'overlays', id: string, label: string) {
    const wrapper = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = state[group][id]
    input.addEventListener('change', () => {
      state[group][id] = input.checked
      onChange()
    })
    const text = document.createElement('span')
    text.textContent = label
    wrapper.appendChild(input)
    wrapper.appendChild(text)
    return wrapper
  }

  Object.entries(legend.biomes).forEach(([id]) => {
    layerControlsEl.appendChild(makeCheckbox('biomes', id, id.replace(/_/g, ' ')))
  })
  Object.entries(legend.overlays).forEach(([id]) => {
    layerControlsEl.appendChild(makeCheckbox('overlays', id, id.replace(/_/g, ' ')))
  })
}

function renderLocations(locations: TerrainLocation[] = [], navigate: (loc: TerrainLocation) => void) {
  locationListEl.innerHTML = ''
  if (!locations.length) {
    const empty = document.createElement('p')
    empty.className = 'muted'
    empty.textContent = 'No locations packaged with this map.'
    locationListEl.appendChild(empty)
    return
  }
  locations.forEach((location) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = location.name ?? location.id
    button.addEventListener('click', () => navigate(location))
    locationListEl.appendChild(button)
  })
}

function navigateToLocation(location: TerrainLocation) {
  terrainHandle?.navigateTo({
    pixel: location.pixel,
    locationId: location.id,
    view: location.view
  })
}

let terrainHandle: TerrainHandle | null = null
let layerState: LayerToggleState | null = null
const interactiveEnabled = false
let activeArchive: LoadedWynFile | null = null
let hostHandle: TerrainViewerHostHandle | null = null
let overlayHandle: ViewerOverlayHandle | null = null

function setStatus(message: string) {
  overlayHandle?.setStatus(message)
}

async function loadArchive(source: { kind: 'default' } | { kind: 'file'; file: File }) {
  terrainHandle?.destroy()
  activeArchive?.dataset.cleanup?.()
  terrainHandle = null

  const loadingLabel = source.kind === 'default' ? 'Downloading wynnal-terrain.wyn…' : `Loading ${source.file.name}…`
  setStatus(loadingLabel)
  overlayHandle?.setLoadingProgress({
    label: loadingLabel,
    loadedBytes: 0,
    totalBytes: source.kind === 'file' ? source.file.size : undefined
  })

  try {
    const archive =
      source.kind === 'default'
        ? await loadWynArchive(resolveArchivePath(), {
            onProgress: (event) => {
              overlayHandle?.setLoadingProgress({
                label: loadingLabel,
                loadedBytes: event.loadedBytes,
                totalBytes: event.totalBytes
              })
            }
          })
        : await loadWynArchiveFromFile(source.file, {
            onProgress: (event) => {
              overlayHandle?.setLoadingProgress({
                label: loadingLabel,
                loadedBytes: event.loadedBytes,
                totalBytes: event.totalBytes ?? source.file.size
              })
            }
          })
    activeArchive = archive
    const { legend, locations } = archive
    layerState = createDefaultLayerState(legend)
    renderLayerControls(legend, layerState, () => {
      if (terrainHandle && layerState) {
        terrainHandle.updateLayers(layerState)
      }
    })
    renderLocations(locations ?? [], (location) => {
      navigateToLocation(location)
    })

    terrainHandle = await initTerrainViewer(viewerEl, archive.dataset, {
      interactive: interactiveEnabled,
      layers: layerState,
      locations,
      onLocationPick: (payload: { pixel: { x: number; y: number }; uv: { u: number; v: number } }) => {
        setStatus(
          `Picked pixel (${payload.pixel.x}, ${payload.pixel.y}) – uv (${payload.uv.u.toFixed(2)}, ${payload.uv.v.toFixed(2)})`
        )
      },
      onLocationHover: (id: any) => {
        if (!id) {
          setStatus('Hovering terrain')
          return
        }
        const location = locations?.find((entry: { id: TerrainLocation['id'] }) => entry.id === id)
        setStatus(location ? `Location: ${location.name ?? location.id}` : `Hovering ${id}`)
      },
      onLocationClick: (id: any) => {
        const location = locations?.find((entry: { id: TerrainLocation['id'] }) => entry.id === id)
        if (location) {
          navigateToLocation(location)
        }
      }
    })
    setStatus('Terrain loaded. Use the controls to explore.')
  } catch (error) {
    console.error(error)
    setStatus('Failed to load terrain archive.')
  } finally {
    overlayHandle?.setLoadingProgress(null)
  }
}

overlayHandle = createViewerOverlay(viewerEl, {
  onFileSelected: (file) => loadArchive({ kind: 'file', file }),
  onRequestPopout: () => hostHandle?.openPopout(),
  onRequestClosePopout: () => hostHandle?.closePopout(),
  onRequestFullscreenToggle: () => hostHandle?.toggleFullscreen().catch((err) => console.warn(err))
})

hostHandle = createTerrainViewerHost({
  viewerElement: viewerEl,
  embedTarget: embedSlot,
  onModeChange: (mode) => overlayHandle?.setViewMode(mode)
})

loadArchive({ kind: 'default' })
