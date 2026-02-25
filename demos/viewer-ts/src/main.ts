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
  type ViewerOverlayHandle,
  enhanceLocationsWithIconUrls
} from '@connected-web/terrain-editor'

const viewerEl = document.getElementById('viewer-root') as HTMLElement
const embedSlot = document.getElementById('viewer-embed-slot') as HTMLElement
const layerControlsBiomesEl = document.getElementById('layer-controls-biomes') as HTMLElement
const layerControlsOverlaysEl = document.getElementById('layer-controls-overlays') as HTMLElement
const locationListEl = document.getElementById('location-list') as HTMLElement
const locationPopupEl = document.getElementById('location-popup') as HTMLElement
const locationPopupIconEl = locationPopupEl.querySelector('[data-location-icon]') as HTMLElement
const locationPopupNameEl = locationPopupEl.querySelector('[data-location-name]') as HTMLElement
const locationPopupCoordsEl = locationPopupEl.querySelector('[data-location-coords]') as HTMLElement
const locationPopupDescriptionEl = locationPopupEl.querySelector(
  '[data-location-description]'
) as HTMLElement
const locationPopupCounterEl = locationPopupEl.querySelector(
  '[data-location-counter]'
) as HTMLElement
const locationPrevButton = locationPopupEl.querySelector('[data-location-prev]') as HTMLButtonElement
const locationNextButton = locationPopupEl.querySelector('[data-location-next]') as HTMLButtonElement
const locationCloseButton = locationPopupEl.querySelector(
  '[data-location-close]'
) as HTMLButtonElement
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]'))
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'))

function resolveArchivePath() {
  const params = new URLSearchParams(window.location.search)
  const mapParam = params.get('map')
  const mapParamValue = mapParam?.replace(/\/+$/, '')
  if (mapParam) {
    if (/^https?:\/\//i.test(mapParamValue ?? '')) {
      return mapParamValue as string
    }
    return new URL(`../maps/${mapParamValue}`, window.location.href).toString()
  }
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
}

function createDefaultLayerState(legend: TerrainLegend): LayerToggleState {
  return {
    biomes: Object.fromEntries(Object.keys(legend.biomes).map((key) => [key, true])),
    overlays: Object.fromEntries(Object.keys(legend.overlays).map((key) => [key, true]))
  }
}

function renderLayerControls(
  legend: TerrainLegend,
  state: LayerToggleState,
  onChange: () => void
) {
  layerControlsBiomesEl.innerHTML = ''
  layerControlsOverlaysEl.innerHTML = ''
  function makeCheckbox(
    group: 'biomes' | 'overlays',
    id: string,
    label: string,
    rgb?: [number, number, number]
  ) {
    const wrapper = document.createElement('label')
    const swatch = document.createElement('span')
    swatch.className = 'layer-swatch'
    swatch.style.background = rgb ? `rgb(${rgb.join(',')})` : '#1b1f2a'
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
    wrapper.appendChild(swatch)
    wrapper.appendChild(text)
    return wrapper
  }

  Object.entries(legend.biomes).forEach(([id, layer]) => {
    layerControlsBiomesEl.appendChild(
      makeCheckbox('biomes', id, id.replace(/_/g, ' '), layer.rgb)
    )
  })
  Object.entries(legend.overlays).forEach(([id, layer]) => {
    layerControlsOverlaysEl.appendChild(
      makeCheckbox('overlays', id, id.replace(/_/g, ' '), layer.rgb)
    )
  })
}

function renderLocations(
  locations: TerrainLocation[] = [],
  navigate: (loc: TerrainLocation) => void,
  clearSelection: () => void
) {
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
    const row = document.createElement('span')
    row.className = 'location-list__item'
    const icon = document.createElement('span')
    icon.className = 'location-list__icon'
    icon.appendChild(resolveIconMarkup(location))
    const label = document.createElement('span')
    label.textContent = location.name ?? location.id
    row.appendChild(icon)
    row.appendChild(label)
    button.appendChild(row)
    button.addEventListener('click', () => {
      if (locationsWithIcons[activeLocationIndex]?.id === location.id) {
        clearSelection()
        return
      }
      navigate(location)
    })
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
let interactiveEnabled = false
let activeArchive: LoadedWynFile | null = null
let hostHandle: TerrainViewerHostHandle | null = null
let overlayHandle: ViewerOverlayHandle | null = null
let iconCleanup: (() => void) | null = null
let locationsWithIcons: Array<TerrainLocation & { iconUrl?: string }> = []
let activeLocationIndex = -1
let popupOpen = false

function setActiveTab(id: string) {
  tabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === id)
  })
  tabPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === id)
  })
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.tab
    if (target) setActiveTab(target)
  })
})
setActiveTab('locations')

function resolveIconMarkup(location: TerrainLocation & { iconUrl?: string }) {
  const url = location.iconUrl
    ?? (location.icon?.startsWith('http') || location.icon?.startsWith('data:')
      ? location.icon
      : undefined)
  if (url) {
    const img = document.createElement('img')
    img.src = url
    img.alt = location.name ?? location.id ?? 'Location'
    return img
  }
  const fallback = document.createElement('span')
  fallback.textContent = (location.name ?? location.id ?? '?').slice(0, 1).toUpperCase()
  return fallback
}

function updateLocationPopup() {
  const location = locationsWithIcons[activeLocationIndex]
  if (!location || !popupOpen) {
    locationPopupEl.classList.add('is-hidden')
    locationPopupIconEl.innerHTML = '?'
    locationPopupNameEl.textContent = 'Unknown'
    locationPopupCoordsEl.textContent = '0, 0'
    locationPopupDescriptionEl.textContent = 'No description provided.'
    locationPopupCounterEl.textContent = '0 / 0'
    terrainHandle?.setCameraOffset(0)
    terrainHandle?.setFocusedLocation(null)
    return
  }

  locationPopupEl.classList.remove('is-hidden')
  locationPopupIconEl.innerHTML = ''
  locationPopupIconEl.appendChild(resolveIconMarkup(location))
  locationPopupNameEl.textContent = location.name ?? location.id ?? 'Unknown'
  locationPopupCoordsEl.textContent = `${location.pixel.x}, ${location.pixel.y}`
  locationPopupDescriptionEl.textContent = location.description || 'No description provided.'
  locationPopupCounterEl.textContent = `${activeLocationIndex + 1} / ${locationsWithIcons.length}`
  terrainHandle?.setCameraOffset(-0.28, location.id)
}

function clearActiveLocation() {
  activeLocationIndex = -1
  popupOpen = false
  updateLocationPopup()
}

function setActiveLocationIndex(index: number, shouldNavigate = true) {
  if (!locationsWithIcons.length) {
    activeLocationIndex = -1
    updateLocationPopup()
    return
  }
  if (index < 0) {
    clearActiveLocation()
    return
  }
  const count = locationsWithIcons.length
  activeLocationIndex = ((index % count) + count) % count
  const location = locationsWithIcons[activeLocationIndex]
  if (shouldNavigate) {
    navigateToLocation(location)
  }
  popupOpen = true
  updateLocationPopup()
}

locationPrevButton.addEventListener('click', () => setActiveLocationIndex(activeLocationIndex - 1))
locationNextButton.addEventListener('click', () => setActiveLocationIndex(activeLocationIndex + 1))
locationCloseButton.addEventListener('click', () => {
  clearActiveLocation()
})

function updateStatus(message: string) {
  overlayHandle?.setStatus(message)
}

async function loadArchive(source: { kind: 'default' } | { kind: 'file'; file: File }) {
  terrainHandle?.destroy()
  activeArchive?.dataset.cleanup?.()
  iconCleanup?.()
  iconCleanup = null
  terrainHandle = null

  const loadingLabel =
    source.kind === 'default' ? 'Downloading wynnal-terrain.wyn…' : `Loading ${source.file.name}…`
  updateStatus(loadingLabel)
  overlayHandle?.setLoadingProgress({
    label: loadingLabel,
    loadedBytes: 0,
    totalBytes: source.kind === 'file' ? source.file.size : undefined
  })
  try {
    const archive =
      source.kind === 'default'
        ? await loadWynArchive(resolveArchivePath(), {
            includeFiles: true,
            onProgress: (event) => {
              overlayHandle?.setLoadingProgress({
                label: loadingLabel,
                loadedBytes: event.loadedBytes,
                totalBytes: event.totalBytes
              })
            }
          })
        : await loadWynArchiveFromFile(source.file, {
            includeFiles: true,
            onProgress: (event) => {
              overlayHandle?.setLoadingProgress({
                label: loadingLabel,
                loadedBytes: event.loadedBytes,
                totalBytes: event.totalBytes ?? source.file.size
              })
            }
          })
    activeArchive = archive
    const enhanced = enhanceLocationsWithIconUrls(archive.locations ?? [], archive.files ?? [])
    locationsWithIcons = enhanced.locations
    iconCleanup = enhanced.cleanup
    layerState = createDefaultLayerState(archive.legend)
    renderLayerControls(archive.legend, layerState, () => {
      if (terrainHandle && layerState) {
        terrainHandle.updateLayers(layerState)
      }
    })
    renderLocations(
      locationsWithIcons,
      (location) => {
        const targetIndex = locationsWithIcons.findIndex((entry) => entry.id === location.id)
        setActiveLocationIndex(targetIndex, true)
      },
      clearActiveLocation
    )

    terrainHandle = await initTerrainViewer(viewerEl, archive.dataset, {
      interactive: interactiveEnabled,
      layers: layerState,
      locations: locationsWithIcons,
      onLocationPick: (payload: { pixel: { x: number; y: number }; uv: { u: number; v: number } }) => {
        updateStatus(
          `Picked pixel (${payload.pixel.x}, ${payload.pixel.y}) – uv (${payload.uv.u.toFixed(2)}, ${payload.uv.v.toFixed(
            2
          )})`
        )
      },
      onLocationHover: (id: any) => {
        if (!id) {
          updateStatus('Hovering terrain')
          return
        }
        const location = locationsWithIcons.find((entry) => entry.id === id)
        updateStatus(location ? `Location: ${location.name ?? location.id}` : `Hovering ${id}`)
      },
      onLocationClick: (id: any) => {
        const location = locationsWithIcons.find((entry) => entry.id === id)
        if (!location) return
        if (locationsWithIcons[activeLocationIndex]?.id === location.id) {
          clearActiveLocation()
          updateStatus('Hovering terrain')
          return
        }
        const targetIndex = locationsWithIcons.findIndex((entry) => entry.id === location.id)
        setActiveLocationIndex(targetIndex, true)
        updateStatus(`Focused location: ${location.name ?? location.id}`)
      }
    })
    popupOpen = locationsWithIcons.length > 0
    setActiveLocationIndex(locationsWithIcons.length ? 0 : -1, false)
    updateStatus('Terrain loaded. Use the controls to explore.')
  } catch (error) {
    console.error(error)
    updateStatus('Failed to load terrain archive.')
  } finally {
    overlayHandle?.setLoadingProgress(null)
  }
}

overlayHandle = createViewerOverlay(viewerEl, {
  selectFile: {
    callback: (file) => loadArchive({ kind: 'file', file })
  },
  popout: {
    onRequestOpen: () => hostHandle?.openPopout(),
    onRequestClose: () => hostHandle?.closePopout()
  },
  fullscreen: {
    onToggle: () => hostHandle?.toggleFullscreen().catch((err) => console.warn(err))
  }
})

hostHandle = createTerrainViewerHost({
  viewerElement: viewerEl,
  embedTarget: embedSlot,
  onModeChange: (mode) => overlayHandle?.setViewMode(mode)
})

loadArchive({ kind: 'default' })
