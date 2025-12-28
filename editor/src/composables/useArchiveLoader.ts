import {
  loadWynArchiveFromArrayBuffer,
  type TerrainDataset,
  type TerrainLegend,
  type TerrainThemeOverrides,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import { arrayBufferToBase64 } from '../utils/storage'

type ProjectStore = {
  loadFromArchive: (payload: {
    legend: TerrainLegend
    locations?: any[]
    theme?: TerrainThemeOverrides
    files?: any[]
    metadata?: Record<string, unknown>
  }) => void
}

type LayerBrowserStore = {
  setLegend: (legend?: TerrainLegend) => void
}

type ArchiveStoreOptions = {
  projectStore: ProjectStore
  layerBrowserStore: LayerBrowserStore
  datasetRef: { value: TerrainDataset | null }
  baseThemeRef: { value: TerrainThemeOverrides | undefined }
  wrapDatasetWithOverrides: (dataset: TerrainDataset) => TerrainDataset
  clearAssetOverrides: () => void
  missingIconWarnings: Set<string>
  refreshIconPreviewCache: () => void
  updateStatus: (message: string, fadeOutDelay?: number) => void
  setOverlayLoading: (state: ViewerOverlayLoadingState | null) => void
  persistCurrentProject: (options: { base64?: string; label?: string }) => Promise<void>
  mountViewer: () => Promise<void>
  disposeViewer: () => void
  cleanupDataset: () => void
  onBeforeLoad?: () => void
  getSampleArchiveUrl: () => string
}

export type LoadArchiveOptions = {
  persist?: boolean
  base64?: string
}

export function useArchiveLoader(options: ArchiveStoreOptions) {
  async function loadArchiveFromBytes(buffer: ArrayBuffer, label: string, loadOptions: LoadArchiveOptions = {}) {
    const loadingLabel = `Loading ${label}…`
    options.updateStatus(loadingLabel)
    options.setOverlayLoading({ label: loadingLabel, loadedBytes: 0 })
    options.disposeViewer()
    options.cleanupDataset()
    options.clearAssetOverrides()
    options.missingIconWarnings.clear()
    options.onBeforeLoad?.()
    try {
      const archive = await loadWynArchiveFromArrayBuffer(buffer, { includeFiles: true })
      const archiveLabel = archive.metadata?.label ?? label
      options.datasetRef.value = options.wrapDatasetWithOverrides(archive.dataset)
      options.baseThemeRef.value = cloneValue(archive.dataset.theme)
      options.layerBrowserStore.setLegend(archive.legend)
      options.projectStore.loadFromArchive({
        legend: archive.legend,
        locations: archive.locations,
        theme: archive.dataset.theme,
        files: archive.files,
        metadata: {
          ...archive.metadata,
          label: archiveLabel
        }
      })
      await options.mountViewer()
      // Note: Status is now managed by viewer lifecycle events (onLifecycleChange)
      // The viewer will show "Map ready." when fully loaded and stabilized
      if (loadOptions.persist ?? true) {
        const base64 = loadOptions.base64 ?? arrayBufferToBase64(buffer)
        await options.persistCurrentProject({ label: archiveLabel, base64 })
      }
    } catch (err) {
      console.error(err)
      options.updateStatus(`Failed to load ${label}.`)
    } finally {
      options.setOverlayLoading(null)
      options.refreshIconPreviewCache()
    }
  }

  async function loadArchiveFromUrl(url: string, label: string, loadOptions: LoadArchiveOptions = {}) {
    try {
      options.updateStatus(`Downloading ${label}…`)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      await loadArchiveFromBytes(buffer, label, loadOptions)
    } catch (err) {
      console.error(err)
      options.updateStatus(`Failed to download ${label}.`)
    }
  }

  async function loadSampleArchive(url?: string, label: string = 'sample archive') {
    const sampleUrl = url ?? options.getSampleArchiveUrl()
    await loadArchiveFromUrl(sampleUrl, label)
  }

  async function loadArchiveFromFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      await loadArchiveFromBytes(buffer, file.name)
    } catch (err) {
      console.error(err)
      options.updateStatus(`Failed to load ${file.name}.`)
    }
  }

  return {
    loadArchiveFromBytes,
    loadArchiveFromFile,
    loadArchiveFromUrl,
    loadSampleArchive
  }
}

function cloneValue<T>(value: T): T {
  return value ? (JSON.parse(JSON.stringify(value)) as T) : value
}
