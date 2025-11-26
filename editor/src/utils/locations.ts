import type { TerrainLocation } from '@connected-web/terrain-editor'

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getPlacementStep(dimension: number) {
  if (!Number.isFinite(dimension) || dimension <= 0) return 0.001
  const normalized = dimension / 1000
  if (normalized >= 1) {
    return Math.max(1, Math.round(normalized))
  }
  return Math.max(0.001, Number(normalized.toFixed(3)))
}

export function snapLocationValue(value: number, dimension: number) {
  const step = getPlacementStep(dimension)
  if (!Number.isFinite(step) || step <= 0) return value
  const snapped = Math.round(value / step) * step
  const decimals = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)))
  const precisionFactor = Math.pow(10, decimals)
  return Math.round(snapped * precisionFactor) / precisionFactor
}

export function ensureLocationId(location: TerrainLocation): TerrainLocation {
  if (!location.id) {
    location.id = `loc-${Math.random().toString(36).slice(2, 10)}`
  }
  return location
}
