import type { TerrainLegend, TerrainProjectFileEntry } from '@connected-web/terrain-editor'

type OverlayValidationResult = {
  errors: string[]
  warnings: string[]
}

function hasFile(path: string, files?: TerrainProjectFileEntry[]) {
  if (!files?.length) return false
  return files.some((entry) => entry.path === path)
}

export function validateOverlayLayers(
  legend: TerrainLegend,
  files?: TerrainProjectFileEntry[]
): OverlayValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const overlays = legend.overlays ?? {}

  for (const [key, layer] of Object.entries(overlays)) {
    const hasMask = typeof (layer as any).mask === 'string' && (layer as any).mask.length > 0
    const hasRgb = Array.isArray((layer as any).rgb) && (layer as any).rgb.length === 3
    const hasRgba = typeof (layer as any).rgba === 'string' && (layer as any).rgba.length > 0

    if (hasRgba && (hasMask || hasRgb)) {
      errors.push(`Overlay "${key}" mixes rgba with mask/rgb. Use only one format.`)
      continue
    }

    if (hasRgba) {
      const path = (layer as any).rgba as string
      if (!hasFile(path, files)) {
        errors.push(`Overlay "${key}" references missing texture asset: ${path}`)
      }
      continue
    }

    if (!hasMask || !hasRgb) {
      errors.push(`Overlay "${key}" is missing mask/rgb or rgba.`)
      continue
    }

    const maskPath = (layer as any).mask as string
    if (!hasFile(maskPath, files)) {
      warnings.push(`Overlay "${key}" references missing mask asset: ${maskPath}`)
    }
  }

  return { errors, warnings }
}
