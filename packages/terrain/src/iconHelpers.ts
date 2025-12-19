import type { TerrainProjectFileEntry } from './editor/projectStore'
import type { TerrainLocation } from './terrainViewer'

export type CreateIconUrlMapOptions = {
  /**
   * Directory prefix to match when building the icon map.
   * Defaults to `icons/`, matching standard .wyn archives.
   */
  prefix?: string
}

export type IconUrlEntry = {
  path: string
  url: string
}

export type IconUrlMapResult = {
  /**
   * Map of file paths (relative to the archive root) to object URLs.
   */
  urls: Map<string, string>
  /**
   * Revoke all allocated object URLs.
   */
  cleanup: () => void
}

export type EnhancedLocationsResult<T extends TerrainLocation = TerrainLocation> = {
  locations: Array<T & { iconUrl?: string }>
  cleanup: () => void
}

function inferMimeType(path: string, fallback = 'image/png'): string {
  const extension = path.split('.').pop()?.toLowerCase()
  if (!extension) return fallback
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'svg') return 'image/svg+xml'
  return fallback
}

function toObjectUrl(entry: TerrainProjectFileEntry): string {
  const type = entry.type ?? inferMimeType(entry.path)
  const blob = new Blob([entry.data], { type })
  return URL.createObjectURL(blob)
}

export function createIconUrlMap(
  files?: TerrainProjectFileEntry[],
  options: CreateIconUrlMapOptions = {}
): IconUrlMapResult {
  const urls = new Map<string, string>()
  const prefix = options.prefix ?? 'icons/'
  if (!files?.length) {
    return {
      urls,
      cleanup: () => undefined
    }
  }

  for (const entry of files) {
    if (!entry.path) continue
    if (prefix && !entry.path.startsWith(prefix)) continue
    const url = toObjectUrl(entry)
    urls.set(entry.path, url)
  }

  const cleanup = () => {
    for (const url of urls.values()) {
      URL.revokeObjectURL(url)
    }
    urls.clear()
  }

  return { urls, cleanup }
}

export function enhanceLocationsWithIconUrls<T extends TerrainLocation = TerrainLocation>(
  locations: T[],
  files?: TerrainProjectFileEntry[],
  options?: CreateIconUrlMapOptions
): EnhancedLocationsResult<T> {
  const { urls, cleanup } = createIconUrlMap(files, options)
  const enhanced = locations.map((location) => {
    if (!location.icon) {
      return { ...location }
    }
    const iconUrl = urls.get(location.icon)
    if (!iconUrl) {
      return { ...location }
    }
    return {
      ...location,
      iconUrl
    }
  })
  return { locations: enhanced, cleanup }
}
