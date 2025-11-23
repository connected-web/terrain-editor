import JSZip from 'jszip'

import type { TerrainProjectFileEntry } from './editor/projectStore'
import type { TerrainDataset, TerrainLegend, TerrainLocation } from './terrainViewer'
import type { TerrainThemeOverrides } from './theme'

export type WynArchiveProgressEvent =
  | {
      type: 'network-download'
      loadedBytes: number
      totalBytes?: number
    }
  | {
      type: 'file-read'
      loadedBytes: number
      totalBytes?: number
    }

export type LoadWynArchiveOptions = {
  onProgress?: (event: WynArchiveProgressEvent) => void
  includeFiles?: boolean
}

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
  files?: TerrainProjectFileEntry[]
}

function parseContentLength(header: string | null): number | undefined {
  if (!header) return undefined
  const parsed = Number(header)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function readResponseWithProgress(
  response: Response,
  onProgress?: (event: WynArchiveProgressEvent) => void
): Promise<ArrayBuffer> {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = await response.arrayBuffer()
    if (onProgress) {
      const totalBytes = buffer.byteLength
      onProgress({ type: 'network-download', loadedBytes: totalBytes, totalBytes })
    }
    return buffer
  }

  const reader = response.body.getReader()
  const totalBytes = parseContentLength(response.headers.get('content-length'))
  const chunks: Uint8Array[] = []
  let loadedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loadedBytes += value.length
      onProgress?.({ type: 'network-download', loadedBytes, totalBytes })
    }
  }
  reader.releaseLock()

  if (!chunks.length) {
    onProgress?.({ type: 'network-download', loadedBytes, totalBytes })
  }

  const merged = new Uint8Array(loadedBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged.buffer
}

async function readFileWithProgress(
  file: File,
  onProgress?: (event: WynArchiveProgressEvent) => void
): Promise<ArrayBuffer> {
  if (typeof FileReader === 'undefined') {
    const buffer = await file.arrayBuffer()
    onProgress?.({ type: 'file-read', loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength })
    return buffer
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Failed to read file.'))
    })
    reader.addEventListener('abort', () => {
      reject(new Error('File read aborted.'))
    })
    reader.addEventListener('load', () => {
      onProgress?.({ type: 'file-read', loadedBytes: file.size, totalBytes: file.size })
      resolve(reader.result as ArrayBuffer)
    })
    if (onProgress) {
      reader.addEventListener('progress', (event: ProgressEvent<FileReader>) => {
        const totalBytes = event.lengthComputable ? event.total : file.size
        onProgress({
          type: 'file-read',
          loadedBytes: event.loaded,
          totalBytes
        })
      })
    }
    reader.readAsArrayBuffer(file)
  })
}

function guessMimeType(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  if (!extension) return undefined
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'json') return 'application/json'
  return undefined
}

const SKIP_FILE_TABLE = new Set(['legend.json', 'locations.json', 'theme.json'])

async function extractProjectFiles(zip: JSZip): Promise<TerrainProjectFileEntry[]> {
  const entries: TerrainProjectFileEntry[] = []
  const fileEntries = Object.values(zip.files)
  for (const entry of fileEntries) {
    if (entry.dir) continue
    if (!entry.name) continue
    if (entry.name.startsWith('__MACOSX/')) continue
    if (SKIP_FILE_TABLE.has(entry.name)) continue
    const path = entry.name
    const data = await entry.async('arraybuffer')
    entries.push({
      path,
      data,
      type: guessMimeType(path),
      lastModified: entry.date?.getTime(),
      sourceFileName: path.split('/').pop()
    })
  }
  return entries
}

async function parseWynZip(zip: JSZip, options: LoadWynArchiveOptions = {}): Promise<LoadedWynFile> {
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
  const files = options.includeFiles ? await extractProjectFiles(zip) : undefined
  return { dataset, legend, locations, files }
}

export async function loadWynArchive(
  url: string,
  options: LoadWynArchiveOptions = {}
): Promise<LoadedWynFile> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch WYN file (${response.status} ${response.statusText})`)
  }
  const arrayBuffer = await readResponseWithProgress(response, options.onProgress)
  const zip = await JSZip.loadAsync(arrayBuffer)
  return parseWynZip(zip, options)
}

export async function loadWynArchiveFromArrayBuffer(
  data: ArrayBuffer,
  options: LoadWynArchiveOptions = {}
): Promise<LoadedWynFile> {
  const zip = await JSZip.loadAsync(data)
  return parseWynZip(zip, options)
}

export async function loadWynArchiveFromFile(
  file: File,
  options: LoadWynArchiveOptions = {}
): Promise<LoadedWynFile> {
  const buffer = await readFileWithProgress(file, options.onProgress)
  return loadWynArchiveFromArrayBuffer(buffer, options)
}
