import { ref } from 'vue'
import {
  initTerrainViewer,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainHandle,
  type TerrainLocation,
  type TerrainThemeOverrides,
  type LocationViewState,
  type ViewerLifecycleState
} from '@connected-web/terrain-editor'
import { playwrightLog, exposeTerrainViewer } from '../utils/playwrightDebug'

type MountContext = {
  dataset: TerrainDataset
  layerState: LayerToggleState
  locations: TerrainLocation[]
  interactive: boolean
  theme?: TerrainThemeOverrides
  onLocationPick: (payload: any) => void
  onLocationClick: (id: string) => void
  initialCameraView?: LocationViewState
}

export function useViewer(options: {
  getViewerElement: () => HTMLElement | null
  getMountContext: () => MountContext | null
}) {
  const handle = ref<TerrainHandle | null>(null)
  const status = ref('Load a Wyn archive to begin.')
  const statusFaded = ref(false)
  const viewerLifecycleState = ref<ViewerLifecycleState>('initializing')
  let statusFadeHandle: number | null = null
  let statusFadeToken = 0
  let remountHandle: number | null = null

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

  function handleLifecycleChange(state: ViewerLifecycleState) {
    viewerLifecycleState.value = state
    playwrightLog('[useViewer] Lifecycle state changed to:', state)

    const stateMessages: Record<ViewerLifecycleState, string> = {
      'initializing': 'Initializing terrain viewer…',
      'loading-textures': 'Loading textures…',
      'building-geometry': 'Building terrain geometry…',
      'first-render': 'Rendering terrain…',
      'stabilizing': 'Stabilizing render…',
      'ready': 'Map ready.'
    }

    const message = stateMessages[state]
    const fadeDelay = state === 'ready' ? 3000 : 0
    updateStatus(message, fadeDelay)
  }

  async function mountViewer(context?: MountContext | null) {
    const nextContext = context ?? options.getMountContext()
    if (!nextContext) return
    const viewerElement = options.getViewerElement()
    if (!viewerElement) return
    disposeViewer()
    viewerLifecycleState.value = 'initializing'
    handle.value = await initTerrainViewer(viewerElement, nextContext.dataset, {
      layers: nextContext.layerState,
      locations: nextContext.locations,
      interactive: nextContext.interactive,
      theme: nextContext.theme,
      cameraView: nextContext.initialCameraView,
      preserveDrawingBuffer: true,
      maxPixelRatio: 1.5,
      onLocationPick: nextContext.onLocationPick,
      onLocationClick: nextContext.onLocationClick,
      onLifecycleChange: handleLifecycleChange
    })
    exposeTerrainViewer(handle.value)
  }

  function disposeViewer() {
    handle.value?.destroy()
    handle.value = null
    exposeTerrainViewer(null)
  }

  function requestViewerRemount() {
    if (remountHandle !== null) {
      window.clearTimeout(remountHandle)
    }
    remountHandle = window.setTimeout(() => {
      remountHandle = null
      void mountViewer()
    }, 80)
  }

  function cleanup() {
    disposeViewer()
    if (statusFadeHandle !== null) {
      window.clearTimeout(statusFadeHandle)
      statusFadeHandle = null
    }
    if (remountHandle !== null) {
      window.clearTimeout(remountHandle)
      remountHandle = null
    }
  }

  return {
    handle,
    status,
    statusFaded,
    viewerLifecycleState,
    updateStatus,
    mountViewer,
    requestViewerRemount,
    disposeViewer,
    cleanup
  }
}
