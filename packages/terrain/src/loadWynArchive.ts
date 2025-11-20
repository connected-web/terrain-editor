import JSZip from 'jszip'

import type {
  TerrainDataset,
  TerrainLegend,
  TerrainLocation
} from './terrainViewer'
import type { TerrainThemeOverrides } from './theme'

function ensureFile(zip: JSZip, path: string) {
  const file = zip.file(path)
  if (!file) {
    throw new Error(`Missing required file in WYN archive: ${path}`)
  }
  return file
}

function createObjectUrlResolver(zip: JSZip) {
  const cache = new Map<string, Promise<string>>()
  const allocated = new Set<string>()

  function getUrl(path: string) {
    if (cache.has(path)) return cache.get(path)!
    const file = zip.file(path)
    if (!file) {
      return Promise.reject(new Error(`Asset not found in WYN archive: ${path}`))
    }
    const promise = file.async('blob').then((blob) => {
      const url = URL.createObjectURL(blob)
      allocated.add(url)
      return url
    })
    cache.set(path, promise)
    return promise
  }

  function cleanup() {
    allocated.forEach((url) => URL.revokeObjectURL(url))
    allocated.clear()
    cache.clear()
  }

  return { getUrl, cleanup }
}

export type LoadedWynFile = {
  dataset: TerrainDataset
  legend: TerrainLegend
  locations?: TerrainLocation[]
}

async function parseWynZip(zip: JSZip): Promise<LoadedWynFile> {
  const legendFile = ensureFile(zip, 'legend.json')
  const legendRaw = await legendFile.async('string')
  const legend = JSON.parse(legendRaw) as TerrainLegend

  const locationEntry = zip.file('locations.json')
  let locations: TerrainLocation[] | undefined
  if (locationEntry) {
    const contents = await locationEntry.async('string')
    locations = JSON.parse(contents) as TerrainLocation[]
  }

  const themeEntry = zip.file('theme.json')
  let themeOverrides: TerrainThemeOverrides | undefined
  if (themeEntry) {
    const contents = await themeEntry.async('string')
    themeOverrides = JSON.parse(contents) as TerrainThemeOverrides
  }

  const { getUrl, cleanup } = createObjectUrlResolver(zip)
  const heightMapPath = legend.heightmap
  const topologyPath = legend.topology ?? legend.heightmap

  const dataset: TerrainDataset = {
    legend,
    getHeightMapUrl: () => getUrl(heightMapPath),
    getTopologyMapUrl: () => getUrl(topologyPath),
    resolveAssetUrl: (path: string) => getUrl(path),
    cleanup,
    theme: themeOverrides
  }
  return { dataset, legend, locations }
}

export async function loadWynArchive(url: string): Promise<LoadedWynFile> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch WYN file (${response.status} ${response.statusText})`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  return parseWynZip(zip)
}

export async function loadWynArchiveFromArrayBuffer(data: ArrayBuffer): Promise<LoadedWynFile> {
  const zip = await JSZip.loadAsync(data)
  return parseWynZip(zip)
}

export async function loadWynArchiveFromFile(file: File): Promise<LoadedWynFile> {
  const buffer = await file.arrayBuffer()
  return loadWynArchiveFromArrayBuffer(buffer)
}
