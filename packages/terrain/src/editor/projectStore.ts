import type { TerrainLegend, TerrainLocation } from '../terrainViewer'
import type { TerrainThemeOverrides } from '../theme'

export type TerrainProjectFileEntry = {
  path: string
  data: ArrayBuffer
  type?: string
  lastModified?: number
  sourceFileName?: string
}

export type TerrainProjectMetadata = {
  label?: string
  source?: 'archive' | 'scratch'
}

export type TerrainProjectSnapshot = {
  legend?: TerrainLegend
  locations?: TerrainLocation[]
  theme?: TerrainThemeOverrides
  metadata: TerrainProjectMetadata
  files: TerrainProjectFileEntry[]
  dirty: boolean
}

export type TerrainProjectStore = {
  getSnapshot: () => TerrainProjectSnapshot
  subscribe: (listener: (snapshot: TerrainProjectSnapshot) => void) => () => void
  loadFromArchive: (payload: {
    legend: TerrainLegend
    locations?: TerrainLocation[]
    theme?: TerrainThemeOverrides
    files?: TerrainProjectFileEntry[]
    metadata?: TerrainProjectMetadata
  }) => void
  setLegend: (legend: TerrainLegend) => void
  setLocations: (locations?: TerrainLocation[]) => void
  setTheme: (theme?: TerrainThemeOverrides) => void
  updateMetadata: (metadata: Partial<TerrainProjectMetadata>) => void
  upsertFile: (entry: TerrainProjectFileEntry) => void
  removeFile: (path: string) => void
  reset: () => void
  markPersisted: () => void
}

type InternalState = {
  legend?: TerrainLegend
  locations?: TerrainLocation[]
  theme?: TerrainThemeOverrides
  metadata: TerrainProjectMetadata
  files: Map<string, TerrainProjectFileEntry>
  dirty: boolean
}

const DEFAULT_METADATA: TerrainProjectMetadata = {
  label: 'Untitled terrain',
  source: 'scratch'
}

function cloneEntry(entry: TerrainProjectFileEntry): TerrainProjectFileEntry {
  return {
    ...entry,
    data: entry.data.slice(0)
  }
}

function createInternalState(initial?: Partial<TerrainProjectSnapshot>): InternalState {
  const files = new Map<string, TerrainProjectFileEntry>()
  initial?.files?.forEach((entry) => files.set(entry.path, cloneEntry(entry)))
  return {
    legend: initial?.legend,
    locations: initial?.locations ? [...initial.locations] : undefined,
    theme: initial?.theme,
    metadata: { ...DEFAULT_METADATA, ...initial?.metadata },
    files,
    dirty: Boolean(initial?.dirty)
  }
}

export function createProjectStore(
  initial?: Partial<TerrainProjectSnapshot>
): TerrainProjectStore {
  const state = createInternalState(initial)
  const listeners = new Set<(snapshot: TerrainProjectSnapshot) => void>()

  function buildSnapshot(): TerrainProjectSnapshot {
    return {
      legend: state.legend,
      locations: state.locations ? [...state.locations] : undefined,
      theme: state.theme,
      metadata: { ...state.metadata },
      files: Array.from(state.files.values()).map((entry) => ({ ...entry })),
      dirty: state.dirty
    }
  }

  function emit() {
    const snapshot = buildSnapshot()
    listeners.forEach((listener) => listener(snapshot))
  }

  function resetInternal() {
    state.legend = undefined
    state.locations = undefined
    state.theme = undefined
    state.metadata = { ...DEFAULT_METADATA }
    state.files.clear()
    state.dirty = false
  }

  function loadFromArchive(payload: {
    legend: TerrainLegend
    locations?: TerrainLocation[]
    theme?: TerrainThemeOverrides
    files?: TerrainProjectFileEntry[]
    metadata?: TerrainProjectMetadata
  }) {
    state.legend = payload.legend
    state.locations = payload.locations ? [...payload.locations] : undefined
    state.theme = payload.theme
    state.metadata = {
      ...DEFAULT_METADATA,
      ...payload.metadata,
      source: 'archive'
    }
    state.files.clear()
    payload.files?.forEach((entry) => {
      state.files.set(entry.path, cloneEntry(entry))
    })
    state.dirty = false
    emit()
  }

  function upsertFile(entry: TerrainProjectFileEntry) {
    state.files.set(entry.path, cloneEntry(entry))
    state.dirty = true
    emit()
  }

  function setLegend(legend: TerrainLegend) {
    state.legend = legend
    state.dirty = true
    emit()
  }

  function setLocations(locations?: TerrainLocation[]) {
    state.locations = locations ? [...locations] : undefined
    state.dirty = true
    emit()
  }

  function setTheme(theme?: TerrainThemeOverrides) {
    state.theme = theme
    state.dirty = true
    emit()
  }

  function updateMetadata(metadata: Partial<TerrainProjectMetadata>) {
    state.metadata = { ...state.metadata, ...metadata }
    state.dirty = true
    emit()
  }

  function removeFile(path: string) {
    if (!state.files.has(path)) return
    state.files.delete(path)
    state.dirty = true
    emit()
  }

  function reset() {
    resetInternal()
    emit()
  }

  function markPersisted() {
    if (!state.dirty) return
    state.dirty = false
    emit()
  }

  function getSnapshot() {
    return buildSnapshot()
  }

  function subscribe(listener: (snapshot: TerrainProjectSnapshot) => void) {
    listeners.add(listener)
    listener(buildSnapshot())
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getSnapshot,
    subscribe,
    loadFromArchive,
    setLegend,
    setLocations,
    setTheme,
    updateMetadata,
    upsertFile,
    removeFile,
    reset,
    markPersisted
  }
}
