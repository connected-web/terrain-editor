import './style.css'

import {
  initTerrainViewer,
  type LayerToggleState,
  type TerrainLegend,
  type TerrainLocation,
  type TerrainHandle
} from '../../../packages/common/initTerrainViewer'
import { loadWynArchive } from '../../../packages/common/loadWynArchive'

const viewerEl = document.getElementById('viewer-root') as HTMLElement
const statusBar = document.getElementById('status-bar') as HTMLElement
const layerControlsEl = document.getElementById('layer-controls') as HTMLElement
const locationListEl = document.getElementById('location-list') as HTMLElement
const interactionBtn = document.getElementById('toggle-interaction') as HTMLButtonElement

const resolveArchivePath = () =>
  new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()

const setStatus = (message: string) => {
  if (statusBar) statusBar.textContent = message
}

const createDefaultLayerState = (legend: TerrainLegend): LayerToggleState => ({
  biomes: Object.fromEntries(Object.keys(legend.biomes).map((key) => [key, true])),
  overlays: Object.fromEntries(Object.keys(legend.overlays).map((key) => [key, true]))
})

const renderLayerControls = (
  legend: TerrainLegend,
  state: LayerToggleState,
  onChange: () => void
) => {
  layerControlsEl.innerHTML = ''
  const makeCheckbox = (group: 'biomes' | 'overlays', id: string, label: string) => {
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

const renderLocations = (locations: TerrainLocation[] = [], navigate: (loc: TerrainLocation) => void) => {
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

let terrainHandle: TerrainHandle | null = null
let layerState: LayerToggleState | null = null
let interactiveEnabled = false

const bootstrap = async () => {
  setStatus('Downloading wynnal-terrain.wyn…')
  try {
    const archiveUrl = resolveArchivePath()
    const { dataset, legend, locations } = await loadWynArchive(archiveUrl)
    layerState = createDefaultLayerState(legend)
    renderLayerControls(legend, layerState, () => {
      if (terrainHandle && layerState) {
        terrainHandle.updateLayers(layerState)
      }
    })
    renderLocations(locations ?? [], (location) => {
      terrainHandle?.navigateTo({
        pixel: location.pixel,
        locationId: location.id,
        view: location.view
      })
    })

    terrainHandle = await initTerrainViewer(viewerEl, dataset, {
      interactive: interactiveEnabled,
      layers: layerState,
      locations,
      onLocationPick: (payload) => {
        setStatus(
          `Picked pixel (${payload.pixel.x}, ${payload.pixel.y}) – uv (${payload.uv.u.toFixed(2)}, ${payload.uv.v.toFixed(2)})`
        )
      },
      onLocationHover: (id) => {
        if (!id) {
          setStatus('Hovering terrain')
          return
        }
        const location = locations?.find((entry) => entry.id === id)
        setStatus(location ? `Hovering ${location.name ?? location.id}` : `Hovering ${id}`)
      },
      onLocationClick: (id) => {
        const location = locations?.find((entry) => entry.id === id)
        if (location) {
          setStatus(`Focused ${location.name ?? location.id}`)
        }
      }
    })
    setStatus('Terrain loaded. Use the controls to explore.')
  } catch (error) {
    console.error(error)
    setStatus('Failed to load terrain archive. Check the console for details.')
  }
}

interactionBtn.addEventListener('click', () => {
  interactiveEnabled = !interactiveEnabled
  interactionBtn.textContent = interactiveEnabled ? 'Disable Placement Mode' : 'Enable Placement Mode'
  terrainHandle?.setInteractiveMode(interactiveEnabled)
})

bootstrap()
