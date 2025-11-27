import { ref } from 'vue'
import {
  initTerrainViewer,
  resolveTerrainTheme,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainHandle,
  type TerrainThemeOverrides,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import { arrayBufferToBase64 } from '../utils/storage'

export function useViewer(options: {
  getViewerElement: () => HTMLElement | null
  getDataset: () => TerrainDataset | null
  getLayerState: () => LayerToggleState | null
  getLocations: () => any[]
  getTheme: () => TerrainThemeOverrides | undefined
  onLocationPick: (payload: any) => void
  onLocationClick: (id: string) => void
}) {
  const handle = ref<TerrainHandle | null>(null)
  const status = ref('Load a Wyn archive to begin.')
  const statusFaded = ref(false)
  let statusFadeHandle: number | null = null
  let statusFadeToken = 0

  function updateStatus(message: string, fadeOutDelay = 0) {
    status.value = message
    statusFaded.value = false
    statusFadeToken += 1
    const token = statusFadeToken
    if (statusFadeHandle !== null) {
      window.clearTimeout(statusFadeHandle)
      statusFadeHandle = null
    }
    if (fadeOutDelay > 0) {
      statusFadeHandle = window.setTimeout(() => {
        if (statusFadeToken === token) {
          statusFaded.value = true
        }
        statusFadeHandle = null
      }, fadeOutDelay)
    }
  }

  async function mountViewer(interactive: boolean) {
    const viewerElement = options.getViewerElement()
    const dataset = options.getDataset()
    const layerState = options.getLayerState()
    if (!viewerElement || !dataset || !layerState) return
    disposeViewer()
    handle.value = await initTerrainViewer(viewerElement, dataset, {
      layers: layerState,
      locations: options.getLocations(),
      interactive,
      theme: options.getTheme(),
      onLocationPick: options.onLocationPick,
      onLocationClick: options.onLocationClick
    })
  }

  function disposeViewer() {
    handle.value?.destroy()
    handle.value = null
  }

  function setOverlayLoading(viewerShell: { setOverlayLoading: (state: ViewerOverlayLoadingState | null) => void } | null, state: ViewerOverlayLoadingState | null) {
    viewerShell?.setOverlayLoading(state)
  }

  function cleanup() {
    disposeViewer()
    if (statusFadeHandle !== null) {
      window.clearTimeout(statusFadeHandle)
      statusFadeHandle = null
    }
  }

  return {
    handle,
    status,
    statusFaded,
    updateStatus,
    mountViewer,
    disposeViewer,
    setOverlayLoading,
    cleanup
  }
}
