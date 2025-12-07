import type {
  TerrainDataset,
  TerrainLegend,
  TerrainProjectFileEntry
} from '@connected-web/terrain-editor'

type ScratchDatasetResult = {
  dataset: TerrainDataset
  files: TerrainProjectFileEntry[]
}

function createSolidImage(width: number, height: number, value: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Unable to create scratch canvas context')
  }
  const channel = Math.max(0, Math.min(255, Math.round(value)))
  ctx.fillStyle = `rgb(${channel}, ${channel}, ${channel})`
  ctx.fillRect(0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/png')
  return {
    url: dataUrl,
    buffer: dataUrlToArrayBuffer(dataUrl)
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIndex = dataUrl.indexOf(',')
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  const binary = atob(payload)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buffer
}

export function buildScratchDataset(legend: TerrainLegend): ScratchDatasetResult {
  const [width, height] = legend.size ?? [512, 512]
  const heightImage = createSolidImage(width, height, 160)
  const topologyImage = createSolidImage(width, height, 255)
  const assetMap = new Map<string, string>()
  const heightPath = legend.heightmap
  const topologyPath = legend.topology ?? legend.heightmap
  assetMap.set(heightPath, heightImage.url)
  assetMap.set(topologyPath, topologyImage.url)

  const dataset: TerrainDataset = {
    legend,
    getHeightMapUrl: () => heightImage.url,
    getTopologyMapUrl: () => topologyImage.url,
    resolveAssetUrl: (path: string) => assetMap.get(path) ?? heightImage.url,
    cleanup: () => {
      assetMap.clear()
    }
  }

  const files: TerrainProjectFileEntry[] = [
    {
      path: heightPath,
      data: heightImage.buffer,
      type: 'image/png',
      sourceFileName: heightPath
    }
  ]
  if (!files.some((entry) => entry.path === topologyPath)) {
    files.push({
      path: topologyPath,
      data: topologyImage.buffer,
      type: 'image/png',
      sourceFileName: topologyPath
    })
  }

  return { dataset, files }
}
