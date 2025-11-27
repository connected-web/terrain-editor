import type { TerrainLegend } from '@connected-web/terrain-editor'
import { clampNumber } from '../utils/locations'
import { useWorkspaceModel, registerWorkspaceActions, type WorkspaceForm } from '../models/workspace'

export function useWorkspace(options: {
  projectSnapshot: { value: { metadata: { label?: string; author?: string }; legend?: TerrainLegend } }
  projectStore: { updateMetadata: (meta: Partial<{ label?: string; author?: string }>) => void; setLegend: (legend: TerrainLegend) => void }
  layerBrowserStore: { setLegend: (legend?: TerrainLegend) => void }
  persistCurrentProject: () => Promise<void>
  setWorkspaceDimensions: (width: number, height: number, legend: TerrainLegend) => void
}) {
  const { workspaceForm } = useWorkspaceModel()

  function resetWorkspaceForm() {
    workspaceForm.label = options.projectSnapshot.value.metadata.label ?? ''
    workspaceForm.author = options.projectSnapshot.value.metadata.author ?? ''
    workspaceForm.width = options.projectSnapshot.value.legend?.size?.[0] ?? 1024
    workspaceForm.height = options.projectSnapshot.value.legend?.size?.[1] ?? 1536
    workspaceForm.seaLevel = options.projectSnapshot.value.legend?.sea_level ?? 0
  }

  function updateProjectLabel(value: string) {
    options.projectStore.updateMetadata({ label: value })
    void options.persistCurrentProject()
  }

  function updateProjectAuthor(value: string) {
    options.projectStore.updateMetadata({ author: value })
    void options.persistCurrentProject()
  }

  function applyMapSize() {
    const legend = options.projectSnapshot.value.legend
    if (!legend) return
    const width = Math.max(1, Math.floor(workspaceForm.width))
    const height = Math.max(1, Math.floor(workspaceForm.height))
    const nextLegend = { ...legend, size: [width, height] as [number, number] }
    options.projectStore.setLegend(nextLegend)
    options.layerBrowserStore.setLegend(nextLegend)
    options.setWorkspaceDimensions(width, height, nextLegend)
    void options.persistCurrentProject()
  }

  function applySeaLevel() {
    const legend = options.projectSnapshot.value.legend
    if (!legend) return
    const seaLevel = clampNumber(Number(workspaceForm.seaLevel), -1, 1)
    workspaceForm.seaLevel = seaLevel
    const nextLegend = { ...legend, sea_level: seaLevel }
    options.projectStore.setLegend(nextLegend)
    options.layerBrowserStore.setLegend(nextLegend)
    options.setWorkspaceDimensions(legend.size[0], legend.size[1], nextLegend)
    void options.persistCurrentProject()
  }

  function createScratchLegend(): TerrainLegend {
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

  registerWorkspaceActions({
    resetWorkspaceForm,
    updateProjectLabel,
    updateProjectAuthor,
    applyMapSize,
    applySeaLevel
  })

  return {
    workspaceForm,
    resetWorkspaceForm,
    updateProjectLabel,
    updateProjectAuthor,
    applyMapSize,
    applySeaLevel,
    createScratchLegend
  }
}
