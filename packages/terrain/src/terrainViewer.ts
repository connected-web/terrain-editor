import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  applyHeightField,
  buildRimMesh,
  createHeightSampler,
  HeightSampler,
  sampleHeightValue
} from './geometry'
import {
  MarkerSpriteStateStyle,
  MarkerSpriteTheme,
  MarkerStemGeometryShape,
  MarkerStemStateStyle,
  MarkerStemTheme,
  resolveTerrainTheme,
  TerrainThemeOverrides
} from './theme'

const DEFAULT_MAP_WIDTH = 1024
const DEFAULT_MAP_HEIGHT = 1536
const DEFAULT_MAP_RATIO = DEFAULT_MAP_HEIGHT / DEFAULT_MAP_WIDTH
const DEFAULT_TERRAIN_WIDTH = 4.2
const DEFAULT_TERRAIN_DEPTH = DEFAULT_TERRAIN_WIDTH * DEFAULT_MAP_RATIO
const SEGMENTS_X = 256
const EDGE_RIM = 0.25
const BASE_THICKNESS = 0.65

const SEA_LEVEL_DEFAULT = 0.28
const FLOOR_Y = -BASE_THICKNESS - 0.22
const HEIGHT_SCALE_DEFAULT = 0.30
const WATER_PERCENT_DEFAULT = 65
const WATER_MIN = -0.08
const WATER_MAX = 0.14
const WATER_INSET = 0.03
const DEFAULT_LAYER_ALPHA: Partial<Record<string, number>> = {
  water: 0.92,
  rivers: 0.95,
  cities: 1,
  roads: 0.85
}
const DEFAULT_STEM_SCALE = 0.01
const MARKER_HEIGHT_RATIO = 0.11
const MARKER_HEIGHT_SCALE = 0.25
const MARKER_MIN_HEIGHT = 0.35
const MARKER_MAX_HEIGHT = 0.85
const MARKER_SPRITE_GAP = 0.08
const MARKER_LABEL_EXTRA_OFFSET = -0.08
const MARKER_SURFACE_OFFSET = 0.00
const BASE_FILL_COLOR = '#7b5c3a'
const SPRITE_CANVAS_WIDTH = 240
const SPRITE_CANVAS_HEIGHT = 160
const ICON_TEXTURE_SIZE = 256
const ICON_CANVAS_MARGIN = 18
const ICON_SCALE_MULTIPLIER = 0.5
const ICON_ASSET_PATTERN = /\.(png|jpe?g|gif|webp|svg)$/i

export type LayerToggleState = {
  biomes: Record<string, boolean>
  overlays: Record<string, boolean>
}

export type LocationViewState = {
  distance: number
  polar: number
  azimuth: number
}

export type TerrainLocation = {
  id: string
  name?: string
  icon?: string
  showBorder?: boolean
  pixel: { x: number; y: number }
  uv?: { u: number; v: number }
  world?: { x: number; y: number; z: number }
  view?: LocationViewState
}

export type LocationPickPayload = {
  pixel: { x: number; y: number }
  uv: { u: number; v: number }
  world: { x: number; y: number; z: number }
}

type TerrainInitOptions = {
  onReady?: () => void
  heightScale?: number
  waterLevelPercent?: number
  layers?: LayerToggleState
  interactive?: boolean
  onLocationPick?: (payload: LocationPickPayload) => void
  onLocationHover?: (locationId: string | null) => void
  onLocationClick?: (locationId: string) => void
  locations?: TerrainLocation[]
  theme?: TerrainThemeOverrides
}

export type TerrainHandle = {
  destroy: () => void
  updateLayers: (state: LayerToggleState) => Promise<void>
  setInteractiveMode: (enabled: boolean) => void
  updateLocations: (locations: TerrainLocation[], focusedId?: string) => void
  navigateTo: (payload: {
    pixel: { x: number; y: number }
    locationId?: string
    world?: { x: number; y: number; z: number }
    view?: LocationViewState
  }) => void
  setHoveredLocation: (id: string | null) => void
  setCameraOffset: (offset: number, focusId?: string) => void
  getViewState: () => LocationViewState
  setTheme: (overrides?: TerrainThemeOverrides) => void
  setSeaLevel: (level: number) => void
}

export type Cleanup = () => void

type Resolvable<T> = T | Promise<T>

export type LegendLayer = {
  mask: string
  rgb: [number, number, number]
}

export type TerrainLegend = {
  size: [number, number]
  sea_level?: number
  heightmap: string
  topology?: string
  biomes: Record<string, LegendLayer>
  overlays: Record<string, LegendLayer>
}

export type TerrainDataset = {
  legend: TerrainLegend
  getHeightMapUrl: () => Resolvable<string>
  getTopologyMapUrl: () => Resolvable<string>
  resolveAssetUrl: (path: string) => Resolvable<string>
  cleanup?: () => void
  theme?: TerrainThemeOverrides
}

function isAssetIconReference(value?: string | null) {
  if (!value) return false
  return value.includes('/') || ICON_ASSET_PATTERN.test(value)
}

function uvToWorld(
  u: number,
  v: number,
  sampler: HeightSampler | null,
  heightScale: number,
  seaLevel: number,
  dimensions: { width: number; depth: number } = {
    width: DEFAULT_TERRAIN_WIDTH,
    depth: DEFAULT_TERRAIN_DEPTH
  }
) {
  if (!sampler) return null
  const heightSample = sampleHeightValue(sampler, u, v)
  const x = (u - 0.5) * dimensions.width
  const z = (v - 0.5) * dimensions.depth
  const y = (heightSample - seaLevel) * heightScale
  return new THREE.Vector3(x, y, z)
}

function easeInOut(t: number) {
  return t * t * (3 - 2 * t)
}

async function loadLegendImage(
  file: string,
  resolveAssetUrl: (path: string) => Resolvable<string>,
  cache: Map<string, HTMLImageElement>
) {
  if (cache.has(file)) return cache.get(file)!
  const url = await Promise.resolve(resolveAssetUrl(file))
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    img.onload = () => resolve(img)
    img.onerror = (event) => reject(new Error(`Failed to load ${file} (${url})`))
  })
  cache.set(file, image)
  return image
}

async function preprocessMask(
  file: string,
  resolveAssetUrl: (path: string) => Resolvable<string>,
  imageCache: Map<string, HTMLImageElement>,
  maskCache: Map<string, HTMLCanvasElement>
) {
  if (maskCache.has(file)) return maskCache.get(file)!
  const img = await loadLegendImage(file, resolveAssetUrl, imageCache)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = Math.max(r, g, b)
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = alpha
  }
  ctx.putImageData(imageData, 0, 0)
  maskCache.set(file, canvas)
  return canvas
}

function hexFromRgb(rgb: [number, number, number]) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

async function composeLegendTexture(
  legendData: TerrainLegend,
  resolveAssetUrl: (path: string) => Resolvable<string>,
  imageCache: Map<string, HTMLImageElement>,
  maskCache: Map<string, HTMLCanvasElement>,
  layerState?: LayerToggleState
) {
  if (typeof document === 'undefined') return null

  const [width, height] = legendData.size
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctxRaw = canvas.getContext('2d')
  if (!ctxRaw) return null
  const ctx = ctxRaw

  ctx.fillStyle = BASE_FILL_COLOR
  ctx.fillRect(0, 0, width, height)

  const temp = document.createElement('canvas')
  temp.width = width
  temp.height = height
  const tempCtxRaw = temp.getContext('2d')
  if (!tempCtxRaw) return null
  const tempCtx = tempCtxRaw

  async function drawLayer(
    maskFile: string,
    color: [number, number, number],
    alpha = 1
  ) {
    let maskImage: HTMLCanvasElement | HTMLImageElement | null = null
    try {
      maskImage = await preprocessMask(maskFile, resolveAssetUrl, imageCache, maskCache)
    } catch (err) {
      console.warn('[WynnalTerrain] Unable to load mask', maskFile, err)
      return
    }
    tempCtx.globalCompositeOperation = 'source-over'
    tempCtx.globalAlpha = 1
    tempCtx.clearRect(0, 0, width, height)
    tempCtx.fillStyle = hexFromRgb(color)
    tempCtx.fillRect(0, 0, width, height)
    tempCtx.globalAlpha = 1
    tempCtx.globalCompositeOperation = 'destination-in'
    tempCtx.drawImage(maskImage, 0, 0, width, height)
    ctx.globalAlpha = alpha
    ctx.drawImage(temp, 0, 0, width, height)
  }

  const activeBiomes = layerState?.biomes ?? {}
  for (const [name, biome] of Object.entries(legendData.biomes)) {
    if (layerState && activeBiomes[name] === false) continue
    await drawLayer(biome.mask, biome.rgb as [number, number, number])
  }

  const activeOverlays = layerState?.overlays ?? {}
  for (const [name, overlay] of Object.entries(legendData.overlays)) {
    if (layerState && activeOverlays[name] === false) continue
    const alpha = DEFAULT_LAYER_ALPHA[name] ?? 1
    await drawLayer(overlay.mask, overlay.rgb as [number, number, number], alpha)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

type MarkerVisualState = 'default' | 'hover' | 'focus'

type MarkerSpriteVisualResource = {
  material: THREE.SpriteMaterial
  texture: THREE.Texture
}

type MarkerSpriteVisualSet = Record<MarkerVisualState, MarkerSpriteVisualResource>

type MarkerStemVisualSet = Record<MarkerVisualState, MarkerStemStateStyle>

function resolveStemState(
  stemTheme: MarkerStemTheme,
  state: MarkerVisualState
): MarkerStemStateStyle {
  const base = stemTheme.states.default
  const overrides =
    state === 'default'
      ? {}
      : state === 'hover'
      ? stemTheme.states.hover ?? {}
      : stemTheme.states.focus ?? {}
  return {
    ...base,
    ...overrides
  }
}

function createMarkerStemVisuals(stemTheme: MarkerStemTheme): MarkerStemVisualSet {
  return {
    default: resolveStemState(stemTheme, 'default'),
    hover: resolveStemState(stemTheme, 'hover'),
    focus: resolveStemState(stemTheme, 'focus')
  }
}

function getStemSegments(shape: MarkerStemGeometryShape) {
  switch (shape) {
    case 'triangle':
      return 3
    case 'square':
      return 4
    case 'pentagon':
      return 5
    case 'hexagon':
      return 6
    case 'cylinder':
    default:
      return 8
  }
}

function createStemGeometry(shape: MarkerStemGeometryShape, radius: number, height: number) {
  const radialSegments = getStemSegments(shape)
  return new THREE.CylinderGeometry(radius, radius, height, radialSegments, 1, false)
}

function markerStateStylesEqual(a: MarkerSpriteStateStyle, b: MarkerSpriteStateStyle) {
  return (
    a.textColor === b.textColor &&
    a.backgroundColor === b.backgroundColor &&
    a.borderColor === b.borderColor &&
    a.borderThickness === b.borderThickness &&
    a.opacity === b.opacity
  )
}

function resolveSpriteState(
  spriteTheme: MarkerSpriteTheme,
  state: MarkerVisualState
): MarkerSpriteStateStyle {
  const base = spriteTheme.states.default
  const overrides =
    state === 'default'
      ? {}
      : state === 'hover'
      ? spriteTheme.states.hover ?? {}
      : spriteTheme.states.focus ?? {}
  return {
    ...base,
    ...overrides
  }
}

type SpriteVisualOptions = {
  iconTexture?: THREE.Texture
  showBorder?: boolean
}

function createIconSpriteTexture(
  iconTexture: THREE.Texture,
  style: MarkerSpriteStateStyle,
  showBorder: boolean
) {
  const source = iconTexture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined
    | null
  if (!source) {
    const fallback = iconTexture.clone()
    fallback.needsUpdate = true
    return fallback
  }
  const canvas = document.createElement('canvas')
  canvas.width = ICON_TEXTURE_SIZE
  canvas.height = ICON_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = iconTexture.clone()
    fallback.needsUpdate = true
    return fallback
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  if (showBorder) {
    const borderRadius = 24
    const inset = 12
    ctx.fillStyle = style.backgroundColor
    drawRoundedRect(
      ctx,
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2,
      borderRadius
    )
    ctx.fill()
    if (style.borderThickness > 0) {
      ctx.strokeStyle = style.borderColor
      ctx.lineWidth = Math.max(1, style.borderThickness * 1.5)
      ctx.stroke()
    }
  }
  ctx.restore()
  const imageLike = source as any
  const rawWidth =
    imageLike?.naturalWidth ??
    imageLike?.width ??
    ICON_TEXTURE_SIZE
  const rawHeight =
    imageLike?.naturalHeight ??
    imageLike?.height ??
    ICON_TEXTURE_SIZE
  const aspect = rawWidth > 0 && rawHeight > 0 ? rawWidth / rawHeight : 1
  const margin = ICON_CANVAS_MARGIN + (showBorder ? 16 : 4)
  const maxWidth = canvas.width - margin * 2
  const maxHeight = canvas.height - margin * 2
  let drawWidth = maxWidth
  let drawHeight = drawWidth / aspect
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight
    drawWidth = drawHeight * aspect
  }
  const offsetX = (canvas.width - drawWidth) / 2
  const offsetY = (canvas.height - drawHeight) / 2
  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createMarkerSpriteResource(
  label: string,
  spriteTheme: MarkerSpriteTheme,
  style: MarkerSpriteStateStyle,
  options?: SpriteVisualOptions
): MarkerSpriteVisualResource {
  if (options?.iconTexture) {
    const texture = createIconSpriteTexture(
      options.iconTexture,
      style,
      options.showBorder ?? true
    )
    texture.needsUpdate = true
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: style.opacity
    })
    return { material, texture }
  }
  const text = (label || '?').trim().slice(0, 14)
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_CANVAS_WIDTH
  canvas.height = SPRITE_CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let fontSize = spriteTheme.maxFontSize
    const minFontSize = spriteTheme.minFontSize
    ctx.font = `${spriteTheme.fontWeight} ${fontSize}px ${spriteTheme.fontFamily}`
    let metrics = ctx.measureText(text)
    const maxBoxWidth = canvas.width - 12 - spriteTheme.paddingX * 2
    while (metrics.width > maxBoxWidth && fontSize > minFontSize) {
      fontSize -= 2
      ctx.font = `${spriteTheme.fontWeight} ${fontSize}px ${spriteTheme.fontFamily}`
      metrics = ctx.measureText(text)
    }
    const boxWidth = Math.min(canvas.width - 12, metrics.width + spriteTheme.paddingX * 2)
    const boxHeight = fontSize + spriteTheme.paddingY * 2
    const boxX = (canvas.width - boxWidth) / 2
    const boxY = (canvas.height - boxHeight) / 2
    if (options?.showBorder ?? true) {
      ctx.fillStyle = style.backgroundColor
      drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, spriteTheme.borderRadius)
      ctx.fill()
      if (style.borderThickness > 0) {
        ctx.strokeStyle = style.borderColor
        ctx.lineWidth = style.borderThickness
        ctx.stroke()
      }
    }
    ctx.fillStyle = style.textColor
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + fontSize * 0.05)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: style.opacity
  })
  return { material, texture }
}

function createMarkerSpriteVisuals(
  label: string,
  spriteTheme: MarkerSpriteTheme,
  options?: SpriteVisualOptions
): MarkerSpriteVisualSet {
  const defaultStyle = resolveSpriteState(spriteTheme, 'default')
  const hoverStyle = resolveSpriteState(spriteTheme, 'hover')
  const focusStyle = resolveSpriteState(spriteTheme, 'focus')
  const defaultResource = createMarkerSpriteResource(label, spriteTheme, defaultStyle, options)
  const hoverResource = markerStateStylesEqual(defaultStyle, hoverStyle)
    ? defaultResource
    : createMarkerSpriteResource(label, spriteTheme, hoverStyle, options)
  const focusResource = markerStateStylesEqual(defaultStyle, focusStyle)
    ? defaultResource
    : markerStateStylesEqual(hoverStyle, focusStyle)
    ? hoverResource
    : createMarkerSpriteResource(label, spriteTheme, focusStyle, options)
  return {
    default: defaultResource,
    hover: hoverResource,
    focus: focusResource
  }
}

function createGradientTexture(renderer: THREE.WebGLRenderer) {
  if (typeof window === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#08152b')
  gradient.addColorStop(1, '#010207')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRenderTarget = pmrem.fromEquirectangular(texture)
  pmrem.dispose()
  return { background: texture, environment: envRenderTarget }
}

function createBaseSlice(width: number, depth: number) {
  const geometry = new THREE.BoxGeometry(width, BASE_THICKNESS, depth)
  const material = new THREE.MeshStandardMaterial({
    color: 0x0f0f18,
    roughness: 0.85,
    metalness: 0.12
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = FLOOR_Y + BASE_THICKNESS / 2
  mesh.receiveShadow = true
  return {
    mesh,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    }
  }
}

function createOceanMesh(
  heightMap: THREE.Texture,
  sampler: HeightSampler,
  heightScale: number,
  waterHeight: number,
  seaLevel: number,
  oceanWidth: number,
  oceanDepth: number
) {
  const surfaceWidth = Math.max(0, oceanWidth - WATER_INSET)
  const surfaceDepth = Math.max(0, oceanDepth - WATER_INSET)
  const surfaceGeometry = new THREE.PlaneGeometry(surfaceWidth, surfaceDepth, 1, 1)
  surfaceGeometry.rotateX(-Math.PI / 2)
  surfaceGeometry.translate(0, waterHeight, 0)

  const uniforms = {
    uHeightMap: { value: heightMap },
    uSeaLevel: { value: seaLevel },
    uHeightScale: { value: heightScale },
    uWaterHeight: { value: waterHeight },
    uLowColor: { value: new THREE.Color('#1b3d4f') },
    uHighColor: { value: new THREE.Color('#4f99ac') },
    uFoamColor: { value: new THREE.Color('#dfeff4') },
    uOpacity: { value: 0.9 }
  }

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = /* glsl */ `
    precision mediump float;
    uniform sampler2D uHeightMap;
    uniform float uSeaLevel;
    uniform float uHeightScale;
    uniform float uWaterHeight;
    uniform vec3 uLowColor;
    uniform vec3 uHighColor;
    uniform vec3 uFoamColor;
    uniform float uOpacity;
    varying vec2 vUv;

    void main() {
      float heightSample = texture2D(uHeightMap, vUv).r;
      float worldY = (heightSample - uSeaLevel) * uHeightScale;
      float mask = clamp(smoothstep(0.08, -0.03, worldY - uWaterHeight), 0.0, 1.0);
      if (mask <= 0.001) discard;
      float foam = smoothstep(0.05, 0.0, abs(worldY - uWaterHeight));
      vec3 color = mix(uLowColor, uHighColor, mask);
      color = mix(color, uFoamColor, foam * 0.25);
      gl_FragColor = vec4(color, mask * uOpacity);
    }
  `

  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })

  const waterRenderOrder = -10

  const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  surfaceMesh.receiveShadow = true
  surfaceMesh.renderOrder = waterRenderOrder

  const waterBottom = FLOOR_Y + BASE_THICKNESS
  const waterDepth = Math.max(0.01, waterHeight - waterBottom)
  const volumeCenterY = waterBottom + waterDepth / 2
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: '#1d415a',
    transparent: true,
    opacity: 0.4,
    roughness: 0.55,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  })
  const frontBackGeometry = new THREE.PlaneGeometry(surfaceWidth, waterDepth)
  const leftRightGeometry = new THREE.PlaneGeometry(surfaceDepth, waterDepth)
  const sideMeshes: THREE.Mesh[] = []

  function addSide(mesh: THREE.Mesh, position: THREE.Vector3, rotation?: THREE.Euler) {
    mesh.position.copy(position)
    if (rotation) {
      mesh.rotation.copy(rotation)
    }
    mesh.renderOrder = waterRenderOrder
    sideMeshes.push(mesh)
  }

  addSide(
    new THREE.Mesh(frontBackGeometry, sideMaterial),
    new THREE.Vector3(0, volumeCenterY, surfaceDepth / 2)
  )
  addSide(
    new THREE.Mesh(frontBackGeometry, sideMaterial),
    new THREE.Vector3(0, volumeCenterY, -surfaceDepth / 2),
    new THREE.Euler(0, Math.PI, 0)
  )
  addSide(
    new THREE.Mesh(leftRightGeometry, sideMaterial),
    new THREE.Vector3(surfaceWidth / 2, volumeCenterY, 0),
    new THREE.Euler(0, -Math.PI / 2, 0)
  )
  addSide(
    new THREE.Mesh(leftRightGeometry, sideMaterial),
    new THREE.Vector3(-surfaceWidth / 2, volumeCenterY, 0),
    new THREE.Euler(0, Math.PI / 2, 0)
  )

  const group = new THREE.Group()
  group.add(surfaceMesh)
  sideMeshes.forEach((mesh) => group.add(mesh))

  return {
    mesh: group,
    dispose: () => {
      surfaceGeometry.dispose()
      surfaceMaterial.dispose()
      frontBackGeometry.dispose()
      leftRightGeometry.dispose()
      sideMaterial.dispose()
    }
  }
}

export async function initTerrainViewer(
  container: HTMLElement,
  dataset: TerrainDataset,
  options: TerrainInitOptions = {}
): Promise<TerrainHandle> {
  if (typeof window === 'undefined') {
    function noop() {}
    return {
      destroy: noop,
      updateLayers: async () => {},
      setInteractiveMode: noop,
      updateLocations: noop,
      navigateTo: noop,
      setHoveredLocation: noop,
      setCameraOffset: noop,
      getViewState: () => ({ distance: 1, polar: Math.PI / 3, azimuth: 0 }),
      setTheme: () => {},
      setSeaLevel: () => {}
    }
  }

  const width = container.clientWidth || 720
  const height = container.clientHeight || 405
  const disposables: Cleanup[] = []

  const legend = dataset.legend
  let themeOverrides = options.theme
  let resolvedTheme = resolveTerrainTheme(dataset.theme, themeOverrides)
  let markerTheme = resolvedTheme.locationMarkers
  let seaLevel = legend.sea_level ?? SEA_LEVEL_DEFAULT
  const initialSeaLevel = seaLevel
  const [rawLegendWidth, rawLegendHeight] = legend.size
  const safeLegendWidth = Math.max(1, rawLegendWidth || DEFAULT_MAP_WIDTH)
  const safeLegendHeight = Math.max(1, rawLegendHeight || DEFAULT_MAP_HEIGHT)
  const mapWidth = Math.max(1, safeLegendWidth)
  const mapHeight = Math.max(1, safeLegendHeight)
  const mapRatio =
    safeLegendWidth > 0 ? safeLegendHeight / safeLegendWidth : DEFAULT_MAP_RATIO
  const terrainWidth = DEFAULT_TERRAIN_WIDTH
  const terrainDepth = terrainWidth * mapRatio
  const terrainSegmentsZ = Math.max(1, Math.round(SEGMENTS_X * mapRatio))
  const terrainDimensions = { width: terrainWidth, depth: terrainDepth }
  const terrainSpan = Math.min(terrainDimensions.width, terrainDimensions.depth)
  function computeMarkerStemHeight() {
    const scaledMin = MARKER_MIN_HEIGHT * MARKER_HEIGHT_SCALE
    const scaledMax = MARKER_MAX_HEIGHT * MARKER_HEIGHT_SCALE
    const rawHeight = terrainSpan * MARKER_HEIGHT_RATIO * MARKER_HEIGHT_SCALE
    return THREE.MathUtils.clamp(rawHeight, scaledMin, scaledMax)
  }
  const markerStemHeight = computeMarkerStemHeight()
  let terrainHeightRange = { min: FLOOR_Y, max: 0 }
  const baseWidth = terrainWidth + EDGE_RIM * 2
  const baseDepth = terrainDepth + EDGE_RIM * 2
  function computeStemRadius(stemTheme: MarkerStemTheme) {
    const rawStemScale = stemTheme.scale
    const stemScale =
      typeof rawStemScale === 'number' && Number.isFinite(rawStemScale)
        ? Math.max(0, rawStemScale)
        : DEFAULT_STEM_SCALE
    const maxStemRadiusCandidate = Math.min(terrainWidth, terrainDepth) * stemScale
    return Number.isFinite(maxStemRadiusCandidate)
      ? Math.min(stemTheme.radius, Math.max(0, maxStemRadiusCandidate))
      : stemTheme.radius
  }

  let stemRadius = computeStemRadius(markerTheme.stem)
  const layerImageCache = new Map<string, HTMLImageElement>()
  const maskCanvasCache = new Map<string, HTMLCanvasElement>()

  function pixelToUV(pixel: { x: number; y: number }) {
    const u = THREE.MathUtils.clamp(pixel.x, 0, mapWidth) / mapWidth
    const v = THREE.MathUtils.clamp(pixel.y, 0, mapHeight) / mapHeight
    return { u, v }
  }

  function uvToPixel(u: number, v: number) {
    const x = THREE.MathUtils.clamp(u * safeLegendWidth, 0, safeLegendWidth)
    const y = THREE.MathUtils.clamp((1 - v) * safeLegendHeight, 0, safeLegendHeight)
    return { x, y }
  }

  function pixelToWorld(pixel: { x: number; y: number }) {
    if (!heightSampler) return null
    const { u, v } = pixelToUV(pixel)
    return uvToWorld(u, v, heightSampler, currentHeightScale, seaLevel, terrainDimensions)
  }

  const heightScale = options.heightScale ?? HEIGHT_SCALE_DEFAULT
  let currentHeightScale = heightScale
  const waterPercent = THREE.MathUtils.clamp(
    options.waterLevelPercent ?? WATER_PERCENT_DEFAULT,
    0,
    100
  )
  const waterPercentNormalized = waterPercent / 100

  function computeWaterHeight() {
    return THREE.MathUtils.mapLinear(
      waterPercentNormalized,
      0,
      1,
      WATER_MIN * currentHeightScale,
      WATER_MAX * currentHeightScale
    )
  }

  let waterHeight = computeWaterHeight()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(43, width / height, 0.1, 100)
  camera.position.set(-5.2, 3.5, 6)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const downAxis = new THREE.Vector3(0, -1, 0)
  const surfaceRaycaster = new THREE.Raycaster()
  const surfaceRayOrigin = new THREE.Vector3()
  let interactiveEnabled = options.interactive ?? false
  let heightSampler: HeightSampler | null = null
  let currentLocations: TerrainLocation[] = options.locations ?? []
  let currentFocusId: string | undefined

  let viewportWidth = width
  let viewportHeight = height
  let viewOffsetPixels = 0

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const hostStyle = window.getComputedStyle(container)
  if (hostStyle.position === 'static') {
    container.style.position = 'relative'
  }
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.right = '0'
  renderer.domElement.style.bottom = '0'
  renderer.domElement.style.left = '0'
  renderer.setSize(width, height, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  disposables.push(() => {
    renderer.dispose()
    renderer.domElement.remove()
  })

  const sky = createGradientTexture(renderer)
  if (sky) {
    scene.background = sky.background
    scene.environment = sky.environment.texture
    disposables.push(() => {
      scene.background = null
      scene.environment = null
      sky.environment.dispose()
      sky.background.dispose()
    })
  }

  const ambientLight = new THREE.AmbientLight(0xf7f0e0, 0.55)
  const warmKey = new THREE.DirectionalLight(0xf8d8ab, 1.1)
  warmKey.position.set(6, 7, 4)
  warmKey.castShadow = true
  warmKey.shadow.mapSize.set(1024, 1024)
  warmKey.shadow.camera.near = 1
  warmKey.shadow.camera.far = 18
  warmKey.shadow.camera.left = -6
  warmKey.shadow.camera.right = 6
  warmKey.shadow.camera.top = 6
  warmKey.shadow.camera.bottom = -6

  const coolFill = new THREE.DirectionalLight(0x7db4ff, 0.4)
  coolFill.position.set(-5, 3, -4)

  scene.add(ambientLight, warmKey, coolFill)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.maxPolarAngle = Math.PI / 2.2
  controls.minDistance = 0.5
  controls.maxDistance = 8.5
  controls.target.set(0, heightScale * 0.28, 0)
  let lastTime = performance.now()

  const markersGroup = new THREE.Group()
  scene.add(markersGroup)
  markersGroup.renderOrder = 10
type MarkerResource = {
  spriteMaterials: Set<THREE.SpriteMaterial>
  spriteTextures: Set<THREE.Texture>
  stemMaterial?: THREE.MeshStandardMaterial
  stemGeometry?: THREE.BufferGeometry
}
const markerResources: MarkerResource[] = []
const markerMap = new Map<
  string,
  {
    container: THREE.Group
    sprite: THREE.Sprite
    stem: THREE.Mesh
    spriteVisuals: MarkerSpriteVisualSet
    stemStates: MarkerStemVisualSet
    iconScale: number
    stemBaseHeight: number
    spriteGap: number
  }
>()
  const markerInteractiveTargets: THREE.Object3D[] = []
  let hoveredLocationId: string | null = null
  const cameraOffset = { target: 0, current: 0 }
  let cameraTween: {
    startPos: THREE.Vector3
    endPos: THREE.Vector3
    startTarget: THREE.Vector3
    endTarget: THREE.Vector3
    start: number
    duration: number
  } | null = null
  let terrain: THREE.Mesh | null = null
  function projectWorldToSurface(world: THREE.Vector3 | null) {
    if (!world) return null
    if (!terrain) return world.clone()
    const originY = (terrainHeightRange.max ?? 0) + 2
    surfaceRayOrigin.set(world.x, originY, world.z)
    surfaceRaycaster.set(surfaceRayOrigin, downAxis)
    const hit = surfaceRaycaster.intersectObject(terrain, true)
    return hit[0]?.point.clone() ?? world.clone()
  }
  function startCameraTween(endPos: THREE.Vector3, endTarget: THREE.Vector3) {
    cameraTween = {
      startPos: camera.position.clone(),
      endPos,
      startTarget: controls.target.clone(),
      endTarget,
      start: performance.now(),
      duration: 650
    }
  }
  const locationWorldCache = new Map<string, THREE.Vector3>()
  let markerGeneration = 0

  const placementIndicator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.01, 0.7, 18),
    new THREE.MeshStandardMaterial({
      color: 0xff5b5b,
      transparent: true,
      opacity: 0.8
    })
  )
  placementIndicator.visible = false
  scene.add(placementIndicator)
  disposables.push(() => {
    placementIndicator.geometry.dispose()
    ;(placementIndicator.material as THREE.Material).dispose()
  })

  const loader = new THREE.TextureLoader()
  const iconTextureCache = new Map<string, THREE.Texture>()
  const iconTexturePromises = new Map<string, Promise<THREE.Texture | null>>()

  function clearMarkerResources() {
    markerResources.splice(0).forEach(({ spriteMaterials, spriteTextures, stemMaterial, stemGeometry }) => {
      spriteMaterials.forEach((material) => material.dispose())
      spriteTextures.forEach((texture) => texture.dispose())
      stemMaterial?.dispose()
      stemGeometry?.dispose()
    })
    markersGroup.clear()
    locationWorldCache.clear()
    markerMap.clear()
    markerInteractiveTargets.length = 0
  }

  function loadIconTexture(iconPath: string): Promise<THREE.Texture | null> {
    if (iconTextureCache.has(iconPath)) {
      return Promise.resolve(iconTextureCache.get(iconPath)!)
    }
    if (iconTexturePromises.has(iconPath)) {
      return iconTexturePromises.get(iconPath)!
    }
    const pending = Promise.resolve(dataset.resolveAssetUrl(iconPath))
      .then(
        (assetUrl) =>
          new Promise<THREE.Texture | null>((resolve) => {
            loader.load(
              assetUrl,
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace
                iconTextureCache.set(iconPath, texture)
                resolve(texture)
              },
              undefined,
              (error) => {
                console.warn('[TerrainViewer] Failed to load icon asset', iconPath, error)
                resolve(null)
              }
            )
          })
      )
      .finally(() => {
        iconTexturePromises.delete(iconPath)
      })
    iconTexturePromises.set(iconPath, pending)
    return pending
  }

  function formatMarkerGlyph(location: TerrainLocation) {
    const rawSource =
      location.icon && !isAssetIconReference(location.icon)
        ? location.icon
        : location.name ?? ''
    const raw = (rawSource || '?').trim()
    if (!raw) return '?'
    const first = raw[0]
    return /[a-zA-Z0-9]/.test(first) ? first.toUpperCase() : raw
  }


  function updateMarkerVisuals() {
    const distance = camera.position.distanceTo(controls.target)
    const lerp = THREE.MathUtils.lerp(controls.minDistance, controls.maxDistance, distance)
    const baseScale = lerp / 80
    const zoomRange = controls.maxDistance - controls.minDistance
    const normalizedZoom =
      zoomRange > 0 ? THREE.MathUtils.clamp((distance - controls.minDistance) / zoomRange, 0, 1) : 0
    const heightScaleFactor = THREE.MathUtils.lerp(0.55, 1.1, normalizedZoom)

    markerMap.forEach(({ sprite, stem, spriteVisuals, stemStates, iconScale, stemBaseHeight, spriteGap }, id) => {
      const isFocused = currentFocusId === id
      const isHovered = hoveredLocationId === id
      const emphasis = isFocused ? 1.2 : isHovered ? 1.05 : 1
      const scaled = baseScale * (iconScale ?? 1) * emphasis
      sprite.scale.set(scaled, scaled, scaled)
      const visualState: MarkerVisualState = isFocused ? 'focus' : isHovered ? 'hover' : 'default'
      const nextVisual = spriteVisuals[visualState]
      if (sprite.material !== nextVisual.material) {
        sprite.material = nextVisual.material
      }
      const stemMat = stem.material as THREE.MeshStandardMaterial
      const stemState = stemStates[visualState]
      stemMat.opacity = stemState.opacity
      stemMat.color.set(stemState.color)
      const stemWidth = THREE.MathUtils.clamp(baseScale * 6, 0.12, 0.6)
      const stemScale = heightScaleFactor
      stem.scale.set(stemWidth, stemScale, stemWidth)
      const currentStemHeight = stemBaseHeight * stemScale
      stem.position.y = currentStemHeight / 2
      const spriteBase = currentStemHeight + spriteGap + MARKER_LABEL_EXTRA_OFFSET
      const spriteHeight = scaled
      sprite.position.y = spriteBase + spriteHeight / 2
    })
  }

  function rebuildRimMesh() {
    if (!rimMesh) return
    scene.remove(rimMesh)
    rimMesh.geometry.dispose()
    rimMesh = buildRimMesh(terrainGeometry, FLOOR_Y, rimMaterial)
    rimMesh.receiveShadow = true
    scene.add(rimMesh)
  }

  function rebuildOceanMesh() {
    if (!heightSampler) return
    if (ocean) {
      scene.remove(ocean.mesh)
      ocean.dispose()
    }
    waterHeight = computeWaterHeight()
    ocean = createOceanMesh(
      heightMap,
      heightSampler,
      currentHeightScale,
      waterHeight,
      seaLevel,
      terrainWidth,
      terrainDepth
    )
    scene.add(ocean.mesh)
  }

  function setLocationMarkers(locations: TerrainLocation[], focusedId?: string) {
    currentLocations = locations
    currentFocusId = focusedId
    markerGeneration += 1
    const runId = markerGeneration
    clearMarkerResources()
    if (!heightSampler || !locations.length) return
    const iconPromises = locations.map((location) => {
      const iconPath = isAssetIconReference(location.icon) ? location.icon! : null
      return iconPath
        ? loadIconTexture(iconPath)
        : Promise.resolve<THREE.Texture | null>(null)
    })
    Promise.all(iconPromises)
      .then((iconTextures) => {
        if (markerGeneration !== runId) return
        locations.forEach((location, i) => {
          const id = location.id ?? `${location.name ?? 'loc'}-${i}`
          location.id = id
          const { u, v } = pixelToUV(location.pixel)
          const world = uvToWorld(
            u,
            v,
            heightSampler,
            currentHeightScale,
            seaLevel,
            terrainDimensions
          )
          if (!world) return
          const surfacePoint = projectWorldToSurface(world)
          if (!surfacePoint) return
          locationWorldCache.set(id, surfacePoint.clone())
          location.world = { x: surfacePoint.x, y: surfacePoint.y, z: surfacePoint.z }
          const glyph = formatMarkerGlyph(location)
          const iconTexture = iconTextures[i] ?? undefined
          const spriteVisuals = createMarkerSpriteVisuals(glyph, markerTheme.sprite, {
            iconTexture,
            showBorder: location.showBorder !== false
          })
          const sprite = new THREE.Sprite(spriteVisuals.default.material)
          sprite.userData.locationId = location.id
          sprite.renderOrder = 10
          const stemHeight = markerStemHeight
          const spriteGap = MARKER_SPRITE_GAP
          const spriteBaseOffset = stemHeight + spriteGap
          const stemStates = createMarkerStemVisuals(markerTheme.stem)
          const stemMaterial = new THREE.MeshStandardMaterial({
            color: stemStates.default.color,
            transparent: true,
            opacity: stemStates.default.opacity,
            flatShading: markerTheme.stem.shape !== 'cylinder'
          })
          const stemGeometry = createStemGeometry(markerTheme.stem.shape, stemRadius, stemHeight)
          const stem = new THREE.Mesh(stemGeometry, stemMaterial)
          stem.renderOrder = 9
          stem.position.set(0, stemHeight / 2, 0)
          sprite.position.set(0, spriteBaseOffset, 0)
          stem.userData.locationId = location.id
          const container = new THREE.Group()
          container.position.copy(surfacePoint)
          container.position.y += MARKER_SURFACE_OFFSET
          container.userData.locationId = location.id
          container.add(stem)
          container.add(sprite)
          markersGroup.add(container)
          const iconScale = iconTexture ? ICON_SCALE_MULTIPLIER : 1
          markerMap.set(location.id, {
            container,
            sprite,
            stem,
            spriteVisuals,
            stemStates,
            iconScale,
            stemBaseHeight: stemHeight,
            spriteGap
          })
          markerInteractiveTargets.push(sprite, stem)
          const spriteMaterials = new Set<THREE.SpriteMaterial>()
          const spriteTextures = new Set<THREE.Texture>()
          Object.values(spriteVisuals).forEach(({ material, texture }) => {
            spriteMaterials.add(material)
            spriteTextures.add(texture)
          })
          markerResources.push({
            spriteMaterials,
            spriteTextures,
            stemMaterial,
            stemGeometry: stem.geometry
          })
        })
        if (markerGeneration === runId) {
          updateMarkerVisuals()
        }
      })
      .catch((error) => console.error('[TerrainViewer] Failed to populate location markers', error))
  }

  function applyThemeUpdate(overrides?: TerrainThemeOverrides) {
    themeOverrides = overrides
    resolvedTheme = resolveTerrainTheme(dataset.theme, themeOverrides)
    markerTheme = resolvedTheme.locationMarkers
    stemRadius = computeStemRadius(markerTheme.stem)
    setLocationMarkers(currentLocations, currentFocusId)
  }

  function applySeaLevelUpdate(nextSeaLevel: number) {
    if (!heightSampler) return
    seaLevel = nextSeaLevel
    legend.sea_level = nextSeaLevel
    dataset.legend.sea_level = nextSeaLevel
    const stats = applyHeightField(terrainGeometry, heightSampler, {
      seaLevel,
      heightScale: currentHeightScale
    })
    terrainHeightRange = { min: stats.minY, max: stats.maxY }
    terrainGeometry.attributes.position.needsUpdate = true
    terrainGeometry.computeVertexNormals()
    rebuildRimMesh()
    rebuildOceanMesh()
    setLocationMarkers(currentLocations, currentFocusId)
  }

  const [heightMapSource, topoMapSource] = await Promise.all([
    Promise.resolve(dataset.getHeightMapUrl()),
    Promise.resolve(dataset.getTopologyMapUrl())
  ])
  const [heightMap, topoTexture] = await Promise.all([
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(heightMapSource, resolve, undefined, reject)
    }),
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(topoMapSource, resolve, undefined, reject)
    })
  ])

  heightMap.wrapS = heightMap.wrapT = THREE.ClampToEdgeWrapping
  topoTexture.wrapS = topoTexture.wrapT = THREE.ClampToEdgeWrapping
  topoTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)

  const sampler = createHeightSampler(heightMap)
  if (!sampler) throw new Error('Unable to read heightmap data')
  heightSampler = sampler

  const terrainGeometry = new THREE.PlaneGeometry(
    terrainWidth,
    terrainDepth,
    SEGMENTS_X,
    terrainSegmentsZ
  )
  terrainGeometry.rotateX(-Math.PI / 2)
  const heightStats = applyHeightField(terrainGeometry, sampler, { seaLevel, heightScale })
  terrainHeightRange = { min: heightStats.minY, max: heightStats.maxY }

  let legendTexture = await composeLegendTexture(
    legend,
    dataset.resolveAssetUrl,
    layerImageCache,
    maskCanvasCache,
    options.layers
  )

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: legendTexture ?? topoTexture,
    roughness: 0.6,
    metalness: 0.18,
    envMapIntensity: 0.45,
    color: new THREE.Color(0xf8f5ed)
  })

  terrain = new THREE.Mesh(terrainGeometry, terrainMaterial)
  terrain.castShadow = true
  terrain.receiveShadow = true
  scene.add(terrain)
  if (currentLocations.length) {
    setLocationMarkers(currentLocations, currentFocusId)
  }

  const base = createBaseSlice(baseWidth, baseDepth)
  scene.add(base.mesh)

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x14121f,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide
  })
  let rimMesh = buildRimMesh(terrainGeometry, FLOOR_Y, rimMaterial)
  rimMesh.receiveShadow = true
  scene.add(rimMesh)

  const createOcean = () =>
    createOceanMesh(
      heightMap,
      sampler,
      heightScale,
      waterHeight,
      seaLevel,
      terrainWidth,
      terrainDepth
    )
  let ocean = createOcean()
  scene.add(ocean.mesh)

  disposables.push(() => {
    terrainGeometry.dispose()
    terrainMaterial.dispose()
    base.dispose()
    rimMesh.geometry.dispose()
    rimMaterial.dispose()
    ocean.dispose()
    heightMap.dispose()
    topoTexture.dispose()
    legendTexture?.dispose()
  })

  disposables.push(() => {
    iconTextureCache.forEach((texture) => texture.dispose())
    iconTextureCache.clear()
    iconTexturePromises.clear()
  })

  function applyViewOffset() {
    if (Math.abs(viewOffsetPixels) < 0.5) {
      if (camera.view?.enabled) {
        camera.clearViewOffset()
        camera.updateProjectionMatrix()
      }
      return
    }
    const shiftPixels = Math.round(viewOffsetPixels)
    camera.setViewOffset(
      viewportWidth,
      viewportHeight,
      shiftPixels,
      0,
      viewportWidth,
      viewportHeight
    )
    camera.updateProjectionMatrix()
  }

  let animationFrame = 0
  function animate() {
    const now = performance.now()
    const delta = Math.min((now - lastTime) / 1000, 0.15)
    lastTime = now
    if (cameraTween) {
      const progress = Math.min((now - cameraTween.start) / cameraTween.duration, 1)
      const eased = easeInOut(progress)
      camera.position
        .copy(cameraTween.startPos)
        .lerp(cameraTween.endPos, eased)
      controls.target
        .copy(cameraTween.startTarget)
        .lerp(cameraTween.endTarget, eased)
      if (progress >= 1) cameraTween = null
    }
    cameraOffset.current = THREE.MathUtils.damp(
      cameraOffset.current,
      cameraOffset.target,
      6,
      delta
    )
    const shiftTarget = cameraOffset.current * viewportWidth * 0.5
    viewOffsetPixels = THREE.MathUtils.damp(viewOffsetPixels, shiftTarget, 6, delta)
    applyViewOffset()
    controls.update()
    updateMarkerVisuals()
    renderer.render(scene, camera)
    animationFrame = window.requestAnimationFrame(animate)
  }
  animate()

  options.onReady?.()

  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = container
    if (!clientWidth || !clientHeight) return
    viewportWidth = clientWidth
    viewportHeight = clientHeight
    const shiftTarget = cameraOffset.current * viewportWidth * 0.5
    viewOffsetPixels = shiftTarget
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(clientWidth, clientHeight, false)
    applyViewOffset()
  })
  resizeObserver.observe(container)

  function setPointerFromEvent(event: PointerEvent | MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    pointer.set(x, y)
    raycaster.setFromCamera(pointer, camera)
  }

  function intersectTerrain() {
    if (!terrain) return null
    const intersections = raycaster.intersectObject(terrain, true)
    return intersections[0] ?? null
  }

  function pickMarkerId() {
    if (!markerInteractiveTargets.length) return null
    const intersections = raycaster.intersectObjects(markerInteractiveTargets, true)
    const hit = intersections.find((entry) => entry.object.userData.locationId)
    return (hit?.object.userData.locationId as string) || null
  }

  function updateHoverState() {
    const markerId = pickMarkerId()
    if (markerId !== hoveredLocationId) {
      hoveredLocationId = markerId
      options.onLocationHover?.(markerId)
      updateMarkerVisuals()
    }
  }

  function updatePlacementIndicator() {
    if (!interactiveEnabled) {
      placementIndicator.visible = false
      return
    }
    const hit = intersectTerrain()
    if (!hit) {
      placementIndicator.visible = false
      return
    }
    placementIndicator.visible = true
    placementIndicator.position.copy(hit.point).setY(hit.point.y + 0.2)
  }

  function handlePointerMove(event: PointerEvent) {
    setPointerFromEvent(event)
    updateHoverState()
    updatePlacementIndicator()
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    setPointerFromEvent(event)
    if (interactiveEnabled && options.onLocationPick) {
      const hit = intersectTerrain()
      if (!hit || !hit.uv) return
      const u = hit.uv.x
      const v = hit.uv.y
      const pixel = uvToPixel(u, v)
      options.onLocationPick?.({
        pixel,
        uv: { u, v },
        world: { x: hit.point.x, y: hit.point.y, z: hit.point.z }
      })
      return
    }
    const markerId = pickMarkerId()
    if (markerId && options.onLocationClick) {
      options.onLocationClick(markerId)
    }
  }

  renderer.domElement.addEventListener('pointermove', handlePointerMove)
  renderer.domElement.addEventListener('pointerdown', handlePointerDown)

  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    setPointerFromEvent(event)
    const hit = intersectTerrain()
    if (!hit) return
    const worldPoint = hit.point.clone()
    const pixel = hit.uv ? uvToPixel(hit.uv.x, hit.uv.y) : { x: worldPoint.x, y: worldPoint.z }
    navigateToLocation({
      pixel,
      world: worldPoint
    })
  }
  renderer.domElement.addEventListener('dblclick', handleDoubleClick)
  disposables.push(() =>
    renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
  )
  disposables.push(() =>
    renderer.domElement.removeEventListener('pointermove', handlePointerMove)
  )
  disposables.push(() =>
    renderer.domElement.removeEventListener('dblclick', handleDoubleClick)
  )

  function setInteractiveMode(enabled: boolean) {
    interactiveEnabled = enabled
    if (enabled) {
      renderer.domElement.classList.add('terrain-pointer-active')
    } else {
      renderer.domElement.classList.remove('terrain-pointer-active')
      placementIndicator.visible = false
    }
  }

  async function updateLayers(state: LayerToggleState) {
    try {
      const newTexture = await composeLegendTexture(
        legend,
        dataset.resolveAssetUrl,
        layerImageCache,
        maskCanvasCache,
        state
      )
      if (!newTexture) return
      legendTexture?.dispose()
      legendTexture = newTexture
      terrainMaterial.map = newTexture
      terrainMaterial.needsUpdate = true
    } catch (err) {
      console.error('Failed to update Wynnal layers', err)
    }
  }

  if (options.layers) await updateLayers(options.layers)
  if (options.locations?.length) setLocationMarkers(options.locations)
  if (interactiveEnabled) setInteractiveMode(true)

  function normalizeWorld(value?: THREE.Vector3 | { x: number; y: number; z: number }) {
    if (!value) return null
    if (value instanceof THREE.Vector3) return value.clone()
    return new THREE.Vector3(value.x, value.y, value.z)
  }

  function navigateToLocation(payload: {
    pixel: { x: number; y: number }
    locationId?: string
    world?: THREE.Vector3 | { x: number; y: number; z: number }
    view?: LocationViewState
  }) {
    const { pixel, locationId, world: worldOverride, view } = payload
    let world =
      normalizeWorld(worldOverride) ||
      (locationId && locationWorldCache.get(locationId)?.clone()) ||
      pixelToWorld(pixel)
    world = projectWorldToSurface(world)
    if (!world) return
    const distance =
      view?.distance ?? Math.max(camera.position.distanceTo(controls.target), 0.1)
    const polar = view?.polar ?? controls.getPolarAngle()
    const azimuth = view?.azimuth ?? controls.getAzimuthalAngle()
    const spherical = new THREE.Spherical(distance, polar, azimuth)
    const orbitOffset = new THREE.Vector3().setFromSpherical(spherical)
    const baseTarget = world.clone()
    const basePos = world.clone().add(orbitOffset)
    const endTarget = baseTarget.clone()
    const endPos = basePos.clone()
    cameraOffset.current = cameraOffset.target
    startCameraTween(endPos, endTarget)
    if (locationId) currentFocusId = locationId
  }

  return {
    destroy: () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      disposables.forEach((dispose) => dispose())
      dataset.cleanup?.()
    },
    updateLayers,
    setInteractiveMode,
    updateLocations: (locations: TerrainLocation[], focusedId?: string) => {
      setLocationMarkers(locations, focusedId)
    },
    navigateTo: navigateToLocation,
    setHoveredLocation: (id: string | null) => {
      hoveredLocationId = id
      updateMarkerVisuals()
    },
    setCameraOffset: (offset: number, focusId?: string) => {
      cameraOffset.target = THREE.MathUtils.clamp(offset, -0.45, 0.45)
      const targetId = focusId ?? currentFocusId
      if (targetId) {
        const loc = currentLocations.find((item) => item.id === targetId)
        if (loc) {
          navigateToLocation({
            pixel: loc.pixel,
            locationId: targetId,
            view: loc.view
          })
        }
      }
    },
    getViewState: () => ({
      distance: Math.max(camera.position.distanceTo(controls.target), 0.1),
      polar: controls.getPolarAngle(),
      azimuth: controls.getAzimuthalAngle()
    }),
    setTheme: applyThemeUpdate,
    setSeaLevel: applySeaLevelUpdate
  }
}
