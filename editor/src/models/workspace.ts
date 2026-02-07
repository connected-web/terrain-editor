import { reactive, ref, type Ref } from 'vue'
import type {
  LayerBrowserState,
  LayerToggleState,
  TerrainDataset,
  TerrainHandle,
  TerrainLegend,
  TerrainLocation,
  ViewerLifecycleState
} from '@connected-web/terrain-editor'
import { clampNumber } from '../utils/locations'
import type { LocalSettings } from '../composables/useLocalSettings'

export type WorkspaceForm = {
  label: string
  author: string
  width: number
  height: number
  seaLevel: number
  heightScale: number
}

export type WorkspaceActions = {
  updateProjectLabel: (value: string) => void
  updateProjectAuthor: (value: string) => void
  applyMapSize: () => void
  applySeaLevel: () => void
  applyHeightScale: () => void
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

export type DockPanel = 'workspace' | 'layers' | 'theme' | 'locations' | 'settings' | 'assets'

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
  viewerLifecycleState?: Ref<ViewerLifecycleState>
  persistCurrentProject: () => Promise<void>
  requestViewerRemount: () => void
  localSettings?: LocalSettings
  setActivePanel?: (panel: DockPanel) => void
  ensureDockExpanded?: () => void
  updateStatus?: (message: string, fadeOutDelay?: number) => void
}

type WorkspaceContext = WorkspaceDependencies & {
  viewerLocationResolver: ((list?: TerrainLocation[]) => TerrainLocation[]) | null
  exportActiveLayerImage: () => void
}

const workspaceForm = reactive<WorkspaceForm>({
  label: '',
  author: '',
  width: 512,
  height: 512,
  seaLevel: 0,
  heightScale: 0.3
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
  workspaceForm.width = snapshot.legend?.size?.[0] ?? 512
  workspaceForm.height = snapshot.legend?.size?.[1] ?? 512
  workspaceForm.seaLevel = snapshot.legend?.sea_level ?? 0
  workspaceForm.heightScale = snapshot.legend?.height_scale ?? 0.3
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
  delayedApplySeaLevel(seaLevel)
  persistProject()
}

let applyDebounceHandle: number | null = null
function delayedApplySeaLevel(value: number) {
  if (applyDebounceHandle !== null) {
    window.clearTimeout(applyDebounceHandle)
  }
  applyDebounceHandle = window.setTimeout(() => {
    applyDebounceHandle = null
    const deps = ensureDependencies()
    deps.handle.value?.setSeaLevel(value)
  }, 250)
}

let heightScaleDebounceHandle: number | null = null
function applyHeightScale() {
  const deps = ensureDependencies()
  const legend = projectSnapshotRef.value.legend
  if (!legend) return
  const heightScale = clampNumber(Number(workspaceForm.heightScale), 0, 1)
  workspaceForm.heightScale = heightScale
  const nextLegend = { ...legend, height_scale: heightScale }
  deps.projectStore.setLegend(nextLegend)
  deps.layerBrowserStore.setLegend(nextLegend)
  delayedApplyHeightScale(heightScale)
  persistProject()
}

function delayedApplyHeightScale(value: number) {
  if (heightScaleDebounceHandle !== null) {
    window.clearTimeout(heightScaleDebounceHandle)
  }
  heightScaleDebounceHandle = window.setTimeout(() => {
    heightScaleDebounceHandle = null
    const deps = ensureDependencies()
    deps.handle.value?.setHeightScale(value)
  }, 250)
}

function createScratchLegendInternal(): TerrainLegend {
  const width = Math.max(1, Math.floor(workspaceForm.width) || 512)
  const height = Math.max(1, Math.floor(workspaceForm.height) || 512)
  const seaLevel = clampNumber(
    Number.isFinite(workspaceForm.seaLevel) ? Number(workspaceForm.seaLevel) : 0,
    -1,
    1
  )
  const heightScale = clampNumber(
    Number.isFinite(workspaceForm.heightScale) ? Number(workspaceForm.heightScale) : 0.3,
    0,
    1
  )
  return {
    size: [width, height] as [number, number],
    heightmap: 'heightmap.png',
    topology: 'heightmap.png',
    sea_level: seaLevel,
    height_scale: heightScale,
    biomes: {},
    overlays: {}
  }
}

function exportActiveLayerImage() {
  const deps = ensureDependencies();
  exportLayerImage().then(blob => {
    if (blob) {
      // Create a download link and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'layer.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      deps.updateStatus?.('No active layer image to export.', 2000);
    }
  });
}

function exportLayerImage(): Promise<Blob | null> {
  const deps = ensureDependencies();
  const state = deps.layerBrowserStore.getState();
  // Select the first entry as the active layer (since 'activeLayerId' does not exist)
  const activeEntry = state.entries[0];
  if (!activeEntry) return Promise.resolve(null);

  // Assume the image is stored in datasetRef as an ImageBitmap or HTMLCanvasElement
  const dataset = deps.datasetRef.value;
  if (!dataset) return Promise.resolve(null);

  // Assuming TerrainDataset has a getLayer(id: string) method or similar
  // Access the layer directly from the dataset's layers property
  const layer = (dataset as any).layers
    ? (dataset as any).layers[activeEntry.id]
    : (dataset as any)[activeEntry.id];

  if (!layer || !layer.image) return Promise.resolve(null);

  // If image is a canvas, use toBlob; if ImageBitmap, draw to canvas first
  if (layer.image instanceof HTMLCanvasElement) {
    return new Promise<Blob | null>(resolve => layer.image.toBlob((blob: Blob | null) => resolve(blob), 'image/png'));
  } else if (layer.image instanceof ImageBitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = layer.image.width;
    canvas.height = layer.image.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(layer.image, 0, 0);
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
  } else if (layer.image instanceof Blob) {
    return Promise.resolve(layer.image);
  }

  return Promise.resolve(null);
}

const workspaceActions: WorkspaceActions = {
  updateProjectLabel,
  updateProjectAuthor,
  applyMapSize,
  applySeaLevel,
  applyHeightScale
}

export function initWorkspaceModel(options: WorkspaceDependencies) {
  dependencies = options
  workspaceContext = {
    ...options,
    viewerLocationResolver,
    exportActiveLayerImage
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
    viewerLifecycleState: workspaceContext.viewerLifecycleState,
    persistCurrentProject: workspaceContext.persistCurrentProject,
    requestViewerRemount: workspaceContext.requestViewerRemount,
    localSettings: workspaceContext.localSettings,
    setActivePanel: workspaceContext.setActivePanel,
    ensureDockExpanded: workspaceContext.ensureDockExpanded,
    updateStatus: workspaceContext.updateStatus,
    exportActiveLayerImage: workspaceContext.exportActiveLayerImage,
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
