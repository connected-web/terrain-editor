import { computed, ref, watch } from 'vue'
import type { LayerToggleState, TerrainHandle } from '@connected-web/terrain-editor'
import { useWorkspaceContext } from '../models/workspace'

export type LayerEntry = {
  id: string
  label: string
  visible: boolean
  icon?: string,
  color: [number, number, number]
  mask?: string
  kind: 'biome' | 'overlay' | 'heightmap'
}

export function useLayersModel(options: {
  layerState: { value: LayerToggleState | null }
  handle: { value: TerrainHandle | null }
}) {
  const workspace = useWorkspaceContext()
  watch(
    () => options.layerState.value,
    async (next) => {
      if (next && options.handle.value) {
        await options.handle.value.updateLayers(next)
      }
    },
    { immediate: true }
  )
  const layerEntries = computed<LayerEntry[]>(() => {
    const legend = workspace.projectSnapshot.value.legend
    const baseEntries = workspace.layerBrowserState.value.entries.map((entry) => ({
      ...entry,
      kind: entry.kind
    }))
    if (!legend) {
      return baseEntries
    }
    const heightEntry: LayerEntry = {
      id: 'heightmap',
      label: 'Height Map',
      visible: true,
      icon: 'mountain',
      color: [255, 255, 255],
      mask: legend.heightmap,
      kind: 'heightmap'
    }
    return [heightEntry, ...baseEntries]
  })
  const layerEditorOpen = ref(false)
  const layerEditorSelectedLayerId = ref<string | null>(null)

  const activeLayer = computed<LayerEntry | null>(() => {
    const selectedId = layerEditorSelectedLayerId.value
    if (!selectedId) {
      return null
    }
    return layerEntries.value.find((entry) => entry.id === selectedId) || null
  })

  function openLayerEditor(id: string) {
    layerEditorSelectedLayerId.value = id
    layerEditorOpen.value = true
  }

  function closeLayerEditor() {
    layerEditorOpen.value = false
  }

  function resetLayerEditor() {
    layerEditorSelectedLayerId.value = null
    layerEditorOpen.value = false
  }

  function exportActiveLayerImage() {
    workspace.exportActiveLayerImage()
  }

  return {
    layerEntries,
    activeLayer,
    layerEditorOpen,
    layerEditorSelectedLayerId,
    openLayerEditor,
    closeLayerEditor,
    resetLayerEditor,
    exportActiveLayerImage,
  }
}
