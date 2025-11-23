import type { LayerToggleState, TerrainLegend } from '../terrainViewer'

export type LayerBrowserEntry = {
  id: string
  kind: 'biome' | 'overlay'
  label: string
  mask: string
  color: [number, number, number]
  visible: boolean
}

export type LayerBrowserState = {
  legend?: TerrainLegend
  entries: LayerBrowserEntry[]
}

export type LayerBrowserStore = {
  getState: () => LayerBrowserState
  subscribe: (listener: (state: LayerBrowserState) => void) => () => void
  setLegend: (legend?: TerrainLegend) => void
  setVisibility: (id: string, visible: boolean) => void
  toggleVisibility: (id: string) => void
  setAll: (kind: 'biome' | 'overlay', visible: boolean) => void
  getLayerToggles: () => LayerToggleState
}

type StoreState = {
  legend?: TerrainLegend
  entries: LayerBrowserEntry[]
}

type VisibilityMap = Map<string, boolean>

function defaultLayerToggles(): LayerToggleState {
  return { biomes: {}, overlays: {} }
}

function makeLayerId(kind: 'biome' | 'overlay', key: string) {
  return `${kind}:${key}`
}

function buildEntries(legend: TerrainLegend | undefined, visibility: VisibilityMap): LayerBrowserEntry[] {
  if (!legend) return []
  const entries: LayerBrowserEntry[] = []
  for (const [key, layer] of Object.entries(legend.biomes ?? {})) {
    const id = makeLayerId('biome', key)
    entries.push({
      id,
      kind: 'biome',
      label: key,
      mask: layer.mask,
      color: layer.rgb,
      visible: visibility.get(id) ?? true
    })
  }
  for (const [key, layer] of Object.entries(legend.overlays ?? {})) {
    const id = makeLayerId('overlay', key)
    entries.push({
      id,
      kind: 'overlay',
      label: key,
      mask: layer.mask,
      color: layer.rgb,
      visible: visibility.get(id) ?? true
    })
  }
  return entries
}

function updateVisibilityFromLegend(legend: TerrainLegend | undefined, visibility: VisibilityMap) {
  if (!legend) return
  for (const key of Object.keys(legend.biomes ?? {})) {
    const id = makeLayerId('biome', key)
    if (!visibility.has(id)) {
      visibility.set(id, true)
    }
  }
  for (const key of Object.keys(legend.overlays ?? {})) {
    const id = makeLayerId('overlay', key)
    if (!visibility.has(id)) {
      visibility.set(id, true)
    }
  }
}

export function createLayerBrowserStore(
  legend?: TerrainLegend,
  initial?: Partial<LayerToggleState>
): LayerBrowserStore {
  const visibility: VisibilityMap = new Map()
  if (initial?.biomes) {
    for (const [key, value] of Object.entries(initial.biomes)) {
      visibility.set(makeLayerId('biome', key), value)
    }
  }
  if (initial?.overlays) {
    for (const [key, value] of Object.entries(initial.overlays)) {
      visibility.set(makeLayerId('overlay', key), value)
    }
  }

  const state: StoreState = {
    legend,
    entries: buildEntries(legend, visibility)
  }

  const listeners = new Set<(state: LayerBrowserState) => void>()

  function emit() {
    const snapshot: LayerBrowserState = {
      legend: state.legend,
      entries: state.entries.map((entry) => ({ ...entry }))
    }
    listeners.forEach((listener) => listener(snapshot))
  }

  function setLegend(next?: TerrainLegend) {
    state.legend = next
    if (!state.legend) {
      visibility.clear()
      state.entries = []
      emit()
      return
    }
    updateVisibilityFromLegend(state.legend, visibility)
    const nextEntries = buildEntries(state.legend, visibility)
    const validIds = new Set(nextEntries.map((entry) => entry.id))
    for (const key of Array.from(visibility.keys())) {
      if (!validIds.has(key)) {
        visibility.delete(key)
      }
    }
    state.entries = nextEntries
    emit()
  }

  function setVisibility(id: string, visible: boolean) {
    if (!state.entries.some((entry) => entry.id === id)) return
    visibility.set(id, visible)
    state.entries = state.entries.map((entry) =>
      entry.id === id ? { ...entry, visible } : entry
    )
    emit()
  }

  function toggleVisibility(id: string) {
    const next = !(visibility.get(id) ?? true)
    setVisibility(id, next)
  }

  function setAll(kind: 'biome' | 'overlay', visible: boolean) {
    let mutated = false
    state.entries = state.entries.map((entry) => {
      if (entry.kind !== kind) return entry
      mutated = true
      visibility.set(entry.id, visible)
      return { ...entry, visible }
    })
    if (mutated) {
      emit()
    }
  }

  function getLayerToggles(): LayerToggleState {
    const toggles = defaultLayerToggles()
    if (!state.legend) return toggles
    for (const [key] of Object.entries(state.legend.biomes ?? {})) {
      const id = makeLayerId('biome', key)
      toggles.biomes[key] = visibility.get(id) ?? true
    }
    for (const [key] of Object.entries(state.legend.overlays ?? {})) {
      const id = makeLayerId('overlay', key)
      toggles.overlays[key] = visibility.get(id) ?? true
    }
    return toggles
  }

  function getState(): LayerBrowserState {
    return {
      legend: state.legend,
      entries: state.entries.map((entry) => ({ ...entry }))
    }
  }

  function subscribe(listener: (snapshot: LayerBrowserState) => void) {
    listeners.add(listener)
    listener(getState())
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState,
    subscribe,
    setLegend,
    setVisibility,
    toggleVisibility,
    setAll,
    getLayerToggles
  }
}
