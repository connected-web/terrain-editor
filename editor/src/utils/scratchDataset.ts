import type { TerrainDataset, TerrainLegend, TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import { createSolidImageData } from './imageFactory'

type ScratchDatasetResult = {
  dataset: TerrainDataset
  files: TerrainProjectFileEntry[]
}

export function buildScratchDataset(legend: TerrainLegend): ScratchDatasetResult {
  const [width, height] = legend.size ?? [512, 512]
  const heightImage = createSolidImageData(width, height, 160)
  const topologyImage = createSolidImageData(width, height, 255)
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
