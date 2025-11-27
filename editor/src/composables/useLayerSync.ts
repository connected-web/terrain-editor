import { watch } from 'vue'
import type { LayerToggleState, TerrainHandle } from '@connected-web/terrain-editor'

export function useLayerSync(options: {
  layerState: { value: LayerToggleState | null }
  handle: { value: TerrainHandle | null }
}) {
  watch(
    () => options.layerState.value,
    async (next) => {
      if (next && options.handle.value) {
        await options.handle.value.updateLayers(next)
      }
    },
    { immediate: true }
  )
}
