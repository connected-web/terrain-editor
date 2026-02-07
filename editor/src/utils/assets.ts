export function normalizeAssetFileName(name: string) {
  const trimmed = name.trim().toLowerCase()
  const segments = trimmed.split('.')
  const ext = segments.length > 1 ? segments.pop() ?? '' : ''
  const base = segments
    .join('.')
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
  const safeExt = ext.replace(/[^a-z0-9]+/g, '')
  return safeExt ? `${base || 'asset'}.${safeExt}` : base || 'asset'
}

export function buildIconPath(name: string) {
  return `icons/${normalizeAssetFileName(name)}`
}

export function buildLayerMaskPath(name: string) {
  const normalized = normalizeAssetFileName(name)
  const base = normalized.replace(/\.[^.]+$/, '')
  return `layers/${base || 'layer'}.png`
}

export function buildLayerTexturePath(name: string) {
  const normalized = normalizeAssetFileName(name)
  const base = normalized.replace(/\.[^.]+$/, '')
  return `layers/${base || 'layer'}-texture.png`
}
