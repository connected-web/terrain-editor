import type { TerrainLegend } from '@connected-web/terrain-editor'
import {
  initWorkspaceModel,
  useWorkspaceModel,
  createScratchLegend as createScratchLegendInternal
} from '../models/workspace'

export function useWorkspace(options: {
  projectSnapshot: { value: { metadata: { label?: string; author?: string }; legend?: TerrainLegend } }
  projectStore: { updateMetadata: (meta: Partial<{ label?: string; author?: string }>) => void; setLegend: (legend: TerrainLegend) => void }
  layerBrowserStore: { setLegend: (legend?: TerrainLegend) => void }
  persistCurrentProject: () => Promise<void>
  setWorkspaceDimensions: (width: number, height: number, legend: TerrainLegend) => void
}) {
  initWorkspaceModel(options)
  const { workspaceForm } = useWorkspaceModel()

  return {
    workspaceForm,
    createScratchLegend: createScratchLegendInternal
  }
}
