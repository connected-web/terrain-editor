import { computed, reactive } from 'vue'
import type {
  TerrainDataset,
  TerrainHandle,
  TerrainLocation,
  TerrainProjectFileEntry
} from '@connected-web/terrain-editor'
import { buildIconPath, normalizeAssetFileName } from '../utils/assets'
import { ensureLocationId } from '../utils/locations'

type ProjectStore = {
  upsertFile: (entry: TerrainProjectFileEntry) => void
  removeFile: (path: string) => void
}

export function useAssetLibrary(options: {
  projectStore: ProjectStore
  projectSnapshot: { value: { files?: TerrainProjectFileEntry[] } }
  datasetRef: { value: TerrainDataset | null }
  locationsList: { value: TerrainLocation[] }
  handle: { value: TerrainHandle | null }
  commitLocations: () => void
}) {
  const assetOverrides = new Map<string, string>()
  const iconPreviewCache = reactive<Record<string, string>>({})
  const iconPreviewOwnership = new Map<string, string>()
  const missingIconWarnings = new Set<string>()

  const projectAssets = computed(() => options.projectSnapshot.value.files ?? [])

  function setAssetOverride(path: string, file: File) {
    const existing = assetOverrides.get(path)
    if (existing) {
      URL.revokeObjectURL(existing)
    }
    const url = URL.createObjectURL(file)
    assetOverrides.set(path, url)
    iconPreviewCache[path] = url
    iconPreviewOwnership.set(path, url)
    missingIconWarnings.delete(path)
    options.handle.value?.invalidateIconTextures?.([path])
  }

  function clearAssetOverrides() {
    assetOverrides.forEach((url) => URL.revokeObjectURL(url))
    assetOverrides.clear()
    refreshIconPreviewCache()
  }

  function resolveAssetReference(reference?: string) {
    if (!reference) return undefined
    if (assetOverrides.has(reference)) return reference
    if (projectAssets.value.some((file) => file.path === reference)) return reference
    const alias = projectAssets.value.find(
      (file) => file.sourceFileName === reference || file.path.endsWith(`/${reference}`)
    )
    return alias?.path ?? reference
  }

  function getIconPreview(icon?: string) {
    const resolved = resolveAssetReference(icon)
    if (!resolved) return ''
    if (missingIconWarnings.has(resolved)) return ''
    if (assetOverrides.has(resolved)) return assetOverrides.get(resolved)!
    if (iconPreviewCache[resolved]) return iconPreviewCache[resolved]
    preloadIconPreview(resolved)
    return ''
  }

  async function preloadIconPreview(path: string, file?: TerrainProjectFileEntry) {
    if (iconPreviewCache[path]) return
    if (missingIconWarnings.has(path)) return
    if (assetOverrides.has(path)) {
      iconPreviewCache[path] = assetOverrides.get(path)!
      return
    }
    if (file) {
      const blob = new Blob([file.data], { type: file.type ?? 'image/png' })
      const url = URL.createObjectURL(blob)
      iconPreviewCache[path] = url
      iconPreviewOwnership.set(path, url)
      missingIconWarnings.delete(path)
      return
    }
    const dataset = options.datasetRef.value
    if (!dataset) return
    try {
      const resolved = await Promise.resolve(dataset.resolveAssetUrl(path))
      iconPreviewCache[path] = resolved
      missingIconWarnings.delete(path)
    } catch (err) {
      if (!missingIconWarnings.has(path)) {
        missingIconWarnings.add(path)
        console.warn(`Icon preview missing for ${path}`)
      }
    }
  }

  function refreshIconPreviewCache() {
    const activePaths = new Set<string>()
    ;(options.projectSnapshot.value.files ?? []).forEach((file) => {
      activePaths.add(file.path)
      preloadIconPreview(file.path, file)
    })
    options.locationsList.value.forEach((location) => {
      if (location.icon) {
        activePaths.add(location.icon)
        preloadIconPreview(location.icon)
      }
    })
    Object.keys(iconPreviewCache).forEach((path) => {
      if (!activePaths.has(path) && !assetOverrides.has(path)) {
        const ownedUrl = iconPreviewOwnership.get(path)
        if (ownedUrl) {
          URL.revokeObjectURL(ownedUrl)
          iconPreviewOwnership.delete(path)
        }
        delete iconPreviewCache[path]
      }
    })
  }

  async function importIconAsset(file: File, targetLocationId?: string, overridePath?: string) {
    const path = overridePath ?? buildIconPath(file.name)
    const buffer = await file.arrayBuffer()
    options.projectStore.upsertFile({
      path,
      data: buffer,
      type: file.type,
      lastModified: file.lastModified,
      sourceFileName: file.name
    })
    setAssetOverride(path, file)
    refreshIconPreviewCache()
    if (targetLocationId) {
      const target = options.locationsList.value.find(
        (location) => ensureLocationId(location).id === targetLocationId
      )
      if (target) {
        target.icon = path
        options.commitLocations()
      }
    }
    return path
  }

  async function replaceAssetWithFile(path: string, file: File) {
    const buffer = await file.arrayBuffer()
    options.projectStore.upsertFile({
      path,
      data: buffer,
      type: file.type,
      lastModified: file.lastModified,
      sourceFileName: file.name
    })
    setAssetOverride(path, file)
    refreshIconPreviewCache()
  }

  function removeAsset(path: string) {
    options.projectStore.removeFile(path)
    if (assetOverrides.has(path)) {
      const url = assetOverrides.get(path)
      if (url) URL.revokeObjectURL(url)
      assetOverrides.delete(path)
    }
    delete iconPreviewCache[path]
    options.locationsList.value = options.locationsList.value.map((location) =>
      location.icon === path ? { ...location, icon: undefined } : location
    )
    options.commitLocations()
    refreshIconPreviewCache()
  }

  function disposeAssetPreviewUrls() {
    iconPreviewOwnership.forEach((url) => URL.revokeObjectURL(url))
    iconPreviewOwnership.clear()
  }

  return {
    assetOverrides,
    iconPreviewCache,
    iconPreviewOwnership,
    missingIconWarnings,
    projectAssets,
    setAssetOverride,
    clearAssetOverrides,
    resolveAssetReference,
    getIconPreview,
    preloadIconPreview,
    refreshIconPreviewCache,
    importIconAsset,
    replaceAssetWithFile,
    removeAsset,
    disposeAssetPreviewUrls,
    normalizeAssetFileName
  }
}
