import defaultThemeConfig from './config/default-theme.config.json'

export type MarkerSpriteStateStyle = {
  textColor: string
  backgroundColor: string
  borderColor: string
  borderThickness: number
  opacity: number
}

export type MarkerSpriteTheme = {
  fontFamily: string
  fontWeight: string
  maxFontSize: number
  minFontSize: number
  paddingX: number
  paddingY: number
  borderRadius: number
  states: {
    default: MarkerSpriteStateStyle
    hover?: Partial<MarkerSpriteStateStyle>
    focus?: Partial<MarkerSpriteStateStyle>
  }
}

export type MarkerStemStateStyle = {
  color: string
  opacity: number
}

export type MarkerStemGeometryShape = 'cylinder' | 'triangle' | 'square' | 'pentagon' | 'hexagon'

export type MarkerStemTheme = {
  shape: MarkerStemGeometryShape
  radius: number
  scale?: number
  heightScale?: number
  states: {
    default: MarkerStemStateStyle
    hover?: Partial<MarkerStemStateStyle>
    focus?: Partial<MarkerStemStateStyle>
  }
}

export type TerrainTheme = {
  locationMarkers: {
    iconScale?: number
    fadeRange?: number
    labelOffset?: number
    sprite: MarkerSpriteTheme
    stem: MarkerStemTheme
  }
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type TerrainThemeOverrides = DeepPartial<TerrainTheme>

const defaultTheme: TerrainTheme = defaultThemeConfig as TerrainTheme

export function getDefaultTerrainTheme(): TerrainTheme {
  return clone(defaultTheme)
}

export function resolveTerrainTheme(
  ...overrides: Array<TerrainTheme | TerrainThemeOverrides | undefined>
): TerrainTheme {
  const theme = getDefaultTerrainTheme()
  overrides.forEach((candidate) => {
    if (candidate) {
      deepMerge(theme, candidate)
    }
  })
  return theme
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry)) as unknown as T
  }
  if (isObject(value)) {
    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = clone(entry)
    })
    return result as T
  }
  return value
}

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  if (!isObject(target) || !isObject(source)) {
    return source as T
  }
  Object.keys(source).forEach((key) => {
    const typedKey = key as keyof T
    const sourceValue = source[typedKey]
    if (sourceValue === undefined) return
    const targetValue = (target as Record<string, unknown>)[key]
    if (isObject(sourceValue)) {
      const nextTarget = isObject(targetValue) ? targetValue : {}
      ;(target as Record<string, unknown>)[key] = deepMerge(nextTarget, sourceValue)
    } else if (Array.isArray(sourceValue)) {
      ;(target as Record<string, unknown>)[key] = sourceValue.map((entry) => clone(entry))
    } else {
      ;(target as Record<string, unknown>)[key] = sourceValue
    }
  })
  return target
}
