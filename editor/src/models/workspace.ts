import { reactive, watch, type Ref, type WatchStopHandle } from 'vue'
import type { TerrainLegend } from '@connected-web/terrain-editor'
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
}

type WorkspaceDependencies = {
  projectSnapshot: Ref<ProjectSnapshot>
  projectStore: {
    updateMetadata: (meta: Partial<{ label?: string; author?: string }>) => void
    setLegend: (legend: TerrainLegend) => void
  }
  layerBrowserStore: { setLegend: (legend?: TerrainLegend) => void }
  persistCurrentProject: () => Promise<void>
  setWorkspaceDimensions: (width: number, height: number, legend: TerrainLegend) => void
}

const workspaceForm = reactive<WorkspaceForm>({
  label: '',
  author: '',
  width: 1024,
  height: 1536,
  seaLevel: 0
})

let dependencies: WorkspaceDependencies | null = null
let stopSnapshotWatch: WatchStopHandle | null = null

function ensureDependencies() {
  if (!dependencies) throw new Error('Workspace model not initialized.')
  return dependencies
}

function syncWorkspaceFormFromSnapshot() {
  if (!dependencies) return
  const snapshot = dependencies.projectSnapshot.value
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
  const legend = deps.projectSnapshot.value.legend
  if (!legend) return
  const width = Math.max(1, Math.floor(workspaceForm.width))
  const height = Math.max(1, Math.floor(workspaceForm.height))
  const nextLegend = { ...legend, size: [width, height] as [number, number] }
  deps.projectStore.setLegend(nextLegend)
  deps.layerBrowserStore.setLegend(nextLegend)
  deps.setWorkspaceDimensions(width, height, nextLegend)
  persistProject()
}

function applySeaLevel() {
  const deps = ensureDependencies()
  const legend = deps.projectSnapshot.value.legend
  if (!legend) return
  const seaLevel = clampNumber(Number(workspaceForm.seaLevel), -1, 1)
  workspaceForm.seaLevel = seaLevel
  const nextLegend = { ...legend, sea_level: seaLevel }
  deps.projectStore.setLegend(nextLegend)
  deps.layerBrowserStore.setLegend(nextLegend)
  deps.setWorkspaceDimensions(legend.size[0], legend.size[1], nextLegend)
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
  stopSnapshotWatch?.()
  stopSnapshotWatch = watch(
    () => options.projectSnapshot.value,
    () => syncWorkspaceFormFromSnapshot(),
    { immediate: true, deep: true }
  )
}

export function createScratchLegend() {
  return createScratchLegendInternal()
}

export function useWorkspaceModel() {
  return {
    workspaceForm,
    actions: workspaceActions
  }
}
