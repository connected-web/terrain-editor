import { computed } from 'vue'
import type { LayerToggleState, TerrainDataset, TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import type { Ref } from 'vue'
import type { TerrainProjectStore } from '@connected-web/terrain-editor/dist/editor/projectStore'
import type { LayerBrowserStore } from '@connected-web/terrain-editor/dist/editor/layerBrowser'

type UseLayerEditorOptions = {
  projectStore: TerrainProjectStore
  layerBrowserStore: LayerBrowserStore
  datasetRef: Ref<TerrainDataset | null>
  layerState: Ref<LayerToggleState | null>
  handle: Ref<{
    updateLayers: (state: LayerToggleState) => Promise<void>
    invalidateLayerMasks?: (paths?: string[]) => void
  } | null>
  persistCurrentProject: () => Promise<void>
  replaceAssetWithFile: (path: string, file: File) => Promise<void>
  requestViewerRemount: () => void
}

export function useLayerEditor(options: UseLayerEditorOptions) {
  async function replaceLayerAsset(asset: TerrainProjectFileEntry) {
    await options.replaceAssetWithFile(
      asset.path,
      new File([asset.data], asset.sourceFileName ?? asset.path)
    )
    options.handle.value?.invalidateLayerMasks?.([asset.path])
    if (options.handle.value && options.layerState.value) {
      await options.handle.value.updateLayers(options.layerState.value)
    }
    const snapshot = options.projectStore.getSnapshot()
    const heightPath = snapshot.legend?.heightmap
    if (asset.path === heightPath) {
      options.requestViewerRemount()
    }
    await options.persistCurrentProject()
  }

  function updateLayerColour(payload: { id: string; color: [number, number, number] }) {
    const snapshot = options.projectStore.getSnapshot()
    const legend = snapshot.legend
    if (!legend) return

    const [rawKind, rawKey] = payload.id.split(':')
    const targetKind = rawKind === 'overlay' ? 'overlays' : 'biomes'
    const key = rawKey ?? rawKind
    const targetGroup = targetKind === 'overlays' ? legend.overlays : legend.biomes
    const targetLayer = targetGroup?.[key]
    if (!targetLayer) return

    const nextLegend = {
      ...legend,
      [targetKind]: {
        ...legend[targetKind],
        [key]: {
          ...targetLayer,
          rgb: payload.color
        }
      }
    }

    options.projectStore.setLegend(nextLegend)
    options.layerBrowserStore.setLegend(nextLegend)
    if (options.datasetRef.value) {
      const datasetLegend = options.datasetRef.value.legend
      const datasetGroup = targetKind === 'overlays' ? datasetLegend.overlays : datasetLegend.biomes
      if (datasetGroup?.[key]) {
        datasetGroup[key] = {
          ...datasetGroup[key],
          rgb: payload.color
        }
      }
    }
    if (options.handle.value && options.layerState.value) {
      void options.handle.value.updateLayers(options.layerState.value)
    }
    options.persistCurrentProject()
  }

  function updateLayerName(payload: { id: string; label: string }) {
    const snapshot = options.projectStore.getSnapshot()
    const legend = snapshot.legend
    if (!legend) return

    const [rawKind, rawKey] = payload.id.split(':')
    const targetKind = rawKind === 'overlay' ? 'overlays' : 'biomes'
    const key = rawKey ?? rawKind
    const targetGroup = targetKind === 'overlays' ? legend.overlays : legend.biomes
    const targetLayer = targetGroup?.[key]
    if (!targetLayer) return

    const nextLegend = {
      ...legend,
      [targetKind]: {
        ...legend[targetKind],
        [key]: {
          ...targetLayer,
          label: payload.label
        }
      }
    }

    options.projectStore.setLegend(nextLegend)
    options.layerBrowserStore.setLegend(nextLegend)
    if (options.datasetRef.value) {
      const datasetLegend = options.datasetRef.value.legend
      const datasetGroup = targetKind === 'overlays' ? datasetLegend.overlays : datasetLegend.biomes
      if (datasetGroup?.[key]) {
        datasetGroup[key] = {
          ...datasetGroup[key],
          label: payload.label
        }
      }
    }
    options.persistCurrentProject()
  }

  return {
    replaceLayerAsset,
    updateLayerColour,
    updateLayerName
  }
}
