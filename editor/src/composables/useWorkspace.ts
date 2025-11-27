import type {
  LayerBrowserState,
  LayerToggleState,
  TerrainDataset,
  TerrainHandle,
  TerrainLegend,
  TerrainLocation
} from '@connected-web/terrain-editor'
import {
  initWorkspaceModel,
  useWorkspaceModel,
  createScratchLegend as createScratchLegendInternal,
  type DockPanel
} from '../models/workspace'
import type { WorkspaceSnapshot } from '../models/workspace'

import type { Ref } from 'vue'

export function useWorkspace(options: {
  projectStore: {
    getSnapshot: () => WorkspaceSnapshot
    subscribe: (listener: (snapshot: WorkspaceSnapshot) => void) => () => void
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
  localSettings?: { cameraTracking: boolean; openLocationsOnSelect: boolean }
  setActivePanel?: (panel: DockPanel) => void
  ensureDockExpanded?: () => void
  updateStatus?: (message: string, fadeOutDelay?: number) => void
}) {
  initWorkspaceModel(options)
  const { workspaceForm, projectSnapshot, layerBrowserState, layerState } = useWorkspaceModel()

  return {
    workspaceForm,
    projectSnapshot,
    layerBrowserState,
    layerState,
    createScratchLegend: createScratchLegendInternal
  }
}
