import { reactive, ref, type Ref } from 'vue'
import type {
  LayerBrowserState,
  LayerToggleState,
  TerrainDataset,
  TerrainHandle,
  TerrainLegend,
  TerrainLocation
} from '@connected-web/terrain-editor'
import { clampNumber } from '../utils/locations'

export type WorkspaceForm = {
  label: string
  author: string
  width: number
  height: number
  seaLevel: number
}

export type WorkspaceActions = {
  resetWorkspaceForm: () => void
  updateProjectLabel: (value: string) => void
  updateProjectAuthor: (value: string) => void
  applyMapSize: () => void
  applySeaLevel: () => void
}

type ProjectSnapshot = {
  metadata: { label?: string; author?: string }
  legend?: TerrainLegend
  locations?: TerrainLocation[]
  theme?: unknown
  files: unknown[]
  dirty: boolean
}

export type WorkspaceSnapshot = ProjectSnapshot

export type DockPanel = 'workspace' | 'layers' | 'theme' | 'locations' | 'settings'

type LocalSettings = {
  cameraTracking: boolean
  openLocationsOnSelect: boolean
}

type WorkspaceDependencies = {
  projectStore: {
    getSnapshot: () => ProjectSnapshot
    subscribe: (listener: (snapshot: ProjectSnapshot) => void) => () => void
    updateMetadata: (meta: Partial<{ label?: string; author?: string }>) => void
    setLegend: (legend: TerrainLegend) => void
    setLocations: (locations?: TerrainLocation[]) => void
  }
  layerBrowserStore: {
    setLegend: (legend?: TerrainLegend) => void
    getState: () => LayerBrowserState
    subscribe: (listener: (state: LayerBrowserState) => void) => () => void
    getLayerToggles: () => LayerToggleState
    toggleVisibility: (id: string) => void
    setAll: (kind: 'biome' | 'overlay', visible: boolean) => void
  }
  datasetRef: Ref<TerrainDataset | null>
  handle: Ref<TerrainHandle | null>
  persistCurrentProject: () => Promise<void>
  requestViewerRemount: () => void
  localSettings?: LocalSettings
  setActivePanel?: (panel: DockPanel) => void
  ensureDockExpanded?: () => void
  updateStatus?: (message: string, fadeOutDelay?: number) => void
}

type WorkspaceContext = WorkspaceDependencies & {
  viewerLocationResolver: ((list?: TerrainLocation[]) => TerrainLocation[]) | null
}

const workspaceForm = reactive<WorkspaceForm>({
  label: '',
  author: '',
  width: 1024,
  height: 1536,
  seaLevel: 0
})

const defaultSnapshot: ProjectSnapshot = {
  metadata: {},
  files: [],
  dirty: false
}

const projectSnapshotRef = ref<ProjectSnapshot>(defaultSnapshot)
const layerBrowserStateRef = ref<LayerBrowserState>({ entries: [] })
const layerStateRef = ref<LayerToggleState | null>(null)

let dependencies: WorkspaceDependencies | null = null
let workspaceContext: WorkspaceContext | null = null
let viewerLocationResolver: ((list?: TerrainLocation[]) => TerrainLocation[]) | null = null
let unsubscribeProject: (() => void) | null = null
let unsubscribeLayerBrowser: (() => void) | null = null

function ensureDependencies() {
  if (!dependencies) throw new Error('Workspace model not initialized.')
  return dependencies
}

function syncWorkspaceFormFromSnapshot() {
  if (!dependencies) return
  const snapshot = projectSnapshotRef.value
  workspaceForm.label = snapshot.metadata.label ?? ''
  workspaceForm.author = snapshot.metadata.author ?? ''
  workspaceForm.width = snapshot.legend?.size?.[0] ?? 1024
  workspaceForm.height = snapshot.legend?.size?.[1] ?? 1536
  workspaceForm.seaLevel = snapshot.legend?.sea_level ?? 0
}

function persistProject() {
  void ensureDependencies().persistCurrentProject()
}

function updateProjectLabel(value: string) {
  const deps = ensureDependencies()
  deps.projectStore.updateMetadata({ label: value })
  persistProject()
}

function updateProjectAuthor(value: string) {
  const deps = ensureDependencies()
  deps.projectStore.updateMetadata({ author: value })
  persistProject()
}

function applyMapSize() {
  const deps = ensureDependencies()
  const legend = projectSnapshotRef.value.legend
  if (!legend) return
  const width = Math.max(1, Math.floor(workspaceForm.width))
  const height = Math.max(1, Math.floor(workspaceForm.height))
  const nextLegend = { ...legend, size: [width, height] as [number, number] }
  deps.projectStore.setLegend(nextLegend)
  deps.layerBrowserStore.setLegend(nextLegend)
  if (deps.datasetRef.value) {
    deps.datasetRef.value.legend = nextLegend
    deps.requestViewerRemount()
  }
  persistProject()
}

function applySeaLevel() {
  const deps = ensureDependencies()
  const legend = projectSnapshotRef.value.legend
  if (!legend) return
  const seaLevel = clampNumber(Number(workspaceForm.seaLevel), -1, 1)
  workspaceForm.seaLevel = seaLevel
  const nextLegend = { ...legend, sea_level: seaLevel }
  deps.projectStore.setLegend(nextLegend)
  deps.layerBrowserStore.setLegend(nextLegend)
  if (deps.datasetRef.value) {
    deps.datasetRef.value.legend = nextLegend
    deps.requestViewerRemount()
  }
  persistProject()
}

function resetWorkspaceForm() {
  syncWorkspaceFormFromSnapshot()
}

function createScratchLegendInternal(): TerrainLegend {
  const width = Math.max(1, Math.floor(workspaceForm.width) || 512)
  const height = Math.max(1, Math.floor(workspaceForm.height) || 512)
  const seaLevel = clampNumber(
    Number.isFinite(workspaceForm.seaLevel) ? Number(workspaceForm.seaLevel) : 0,
    -1,
    1
  )
  return {
    size: [width, height] as [number, number],
    heightmap: 'heightmap.png',
    topology: 'heightmap.png',
    sea_level: seaLevel,
    biomes: {},
    overlays: {}
  }
}

const workspaceActions: WorkspaceActions = {
  resetWorkspaceForm,
  updateProjectLabel,
  updateProjectAuthor,
  applyMapSize,
  applySeaLevel
}

export function initWorkspaceModel(options: WorkspaceDependencies) {
  dependencies = options
  workspaceContext = {
    ...options,
    viewerLocationResolver
  }
  unsubscribeProject?.()
  unsubscribeLayerBrowser?.()
  projectSnapshotRef.value = options.projectStore.getSnapshot()
  layerBrowserStateRef.value = options.layerBrowserStore.getState()
  layerStateRef.value = options.layerBrowserStore.getLayerToggles()
  syncWorkspaceFormFromSnapshot()
  unsubscribeProject = options.projectStore.subscribe((snapshot) => {
    projectSnapshotRef.value = snapshot
    syncWorkspaceFormFromSnapshot()
  })
  unsubscribeLayerBrowser = options.layerBrowserStore.subscribe((state) => {
    layerBrowserStateRef.value = state
    layerStateRef.value = options.layerBrowserStore.getLayerToggles()
  })
}

export function createScratchLegend() {
  return createScratchLegendInternal()
}

export function useWorkspaceModel() {
  return {
    workspaceForm,
    actions: workspaceActions,
    projectSnapshot: projectSnapshotRef,
    layerBrowserState: layerBrowserStateRef,
    layerState: layerStateRef
  }
}

export function useWorkspaceContext() {
  if (!workspaceContext) {
    throw new Error('Workspace context not initialized.')
  }
  return {
    projectSnapshot: projectSnapshotRef,
    projectStore: workspaceContext.projectStore,
    layerBrowserStore: workspaceContext.layerBrowserStore,
    layerBrowserState: layerBrowserStateRef,
    layerState: layerStateRef,
    datasetRef: workspaceContext.datasetRef,
    handle: workspaceContext.handle,
    persistCurrentProject: workspaceContext.persistCurrentProject,
    requestViewerRemount: workspaceContext.requestViewerRemount,
    localSettings: workspaceContext.localSettings,
    setActivePanel: workspaceContext.setActivePanel,
    ensureDockExpanded: workspaceContext.ensureDockExpanded,
    updateStatus: workspaceContext.updateStatus,
    getViewerLocations: (list?: TerrainLocation[]) => {
      if (!viewerLocationResolver) {
        throw new Error('Viewer location resolver not registered.')
      }
      return viewerLocationResolver(list)
    }
  }
}

export function registerViewerLocationResolver(resolver: (list?: TerrainLocation[]) => TerrainLocation[]) {
  viewerLocationResolver = resolver
  if (workspaceContext) {
    workspaceContext.viewerLocationResolver = resolver
  }
}
