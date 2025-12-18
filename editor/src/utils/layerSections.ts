import type { LayerEntry } from '../composables/useLayersModel'

export type LayerSectionKey = 'heightmap' | 'biome' | 'overlay'

export type LayerSection = {
  key: LayerSectionKey
  label: string
  entries: LayerEntry[]
}

export function buildLayerSections(entries: LayerEntry[]): LayerSection[] {
  const buckets: Record<LayerSectionKey, LayerEntry[]> = {
    heightmap: [],
    biome: [],
    overlay: []
  }

  for (const entry of entries) {
    if (entry.kind === 'heightmap') {
      buckets.heightmap.push(entry)
    } else if (entry.kind === 'overlay') {
      buckets.overlay.push(entry)
    } else {
      buckets.biome.push(entry)
    }
  }

  const sections: LayerSection[] = []
  if (buckets.heightmap.length) {
    sections.push({ key: 'heightmap', label: 'Height Map', entries: buckets.heightmap })
  }
  if (buckets.biome.length) {
    sections.push({ key: 'biome', label: 'Biomes', entries: buckets.biome })
  }
  if (buckets.overlay.length) {
    sections.push({ key: 'overlay', label: 'Overlays', entries: buckets.overlay })
  }

  return sections
}

