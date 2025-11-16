import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  applyHeightField,
  buildRimMesh,
  createHeightSampler,
  HeightSampler,
  sampleHeightValue
} from './geometry'

const MAP_RATIO = 1536 / 1024
const TERRAIN_WIDTH = 4.2
const TERRAIN_DEPTH = TERRAIN_WIDTH * MAP_RATIO
const SEGMENTS_X = 256
const SEGMENTS_Z = Math.round(SEGMENTS_X * MAP_RATIO)
const EDGE_RIM = 0.25
const BASE_WIDTH = TERRAIN_WIDTH + EDGE_RIM * 2
const BASE_DEPTH = TERRAIN_DEPTH + EDGE_RIM * 2
const BASE_THICKNESS = 0.65

const SEA_LEVEL_DEFAULT = 0.28
const FLOOR_Y = -BASE_THICKNESS - 0.22
const HEIGHT_SCALE_DEFAULT = 0.45
const WATER_PERCENT_DEFAULT = 65
const WATER_MIN = -0.08
const WATER_MAX = 0.14
const WATER_INSET = 0.08
const DEFAULT_LAYER_ALPHA: Partial<Record<string, number>> = {
  water: 0.92,
  rivers: 0.95,
  cities: 1,
  roads: 0.85
}
const BASE_FILL_COLOR = '#7b5c3a'

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
}

function uvToWorld(
  u: number,
  v: number,
  sampler: HeightSampler | null,
  heightScale: number,
  seaLevel: number
) {
  if (!sampler) return null
  const heightSample = sampleHeightValue(sampler, u, v)
  const x = (u - 0.5) * TERRAIN_WIDTH
  const z = (v - 0.5) * TERRAIN_DEPTH
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

function createMarkerMaterial(label: string) {
  const text = (label || '?').trim().slice(0, 14)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let fontSize = 52
    ctx.font = `${fontSize}px "DM Sans", sans-serif`
    let metrics = ctx.measureText(text)
    while (metrics.width > canvas.width - 60 && fontSize > 22) {
      fontSize -= 4
      ctx.font = `${fontSize}px "DM Sans", sans-serif`
      metrics = ctx.measureText(text)
    }
    const paddingX = 24
    const paddingY = 14
    const boxWidth = Math.min(canvas.width - 12, metrics.width + paddingX * 2)
    const boxHeight = fontSize + paddingY * 2
    const boxX = (canvas.width - boxWidth) / 2
    const boxY = (canvas.height - boxHeight) / 2
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)'
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 18)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + fontSize * 0.05)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  })
  return { material, texture }
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

function createBaseSlice() {
  const geometry = new THREE.BoxGeometry(BASE_WIDTH, BASE_THICKNESS, BASE_DEPTH)
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
  seaLevel: number
) {
  const oceanWidth = Math.max(0, TERRAIN_WIDTH - WATER_INSET)
  const oceanDepth = Math.max(0, TERRAIN_DEPTH - WATER_INSET)
  const geometry = new THREE.PlaneGeometry(oceanWidth, oceanDepth, 1, 1)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, waterHeight, 0)

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

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return {
    mesh,
    dispose: () => {
      geometry.dispose()
      material.dispose()
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
      getViewState: () => ({ distance: 1, polar: Math.PI / 3, azimuth: 0 })
    }
  }

  const width = container.clientWidth || 720
  const height = container.clientHeight || 405
  const disposables: Cleanup[] = []

  const legend = dataset.legend
  const seaLevel = legend.sea_level ?? SEA_LEVEL_DEFAULT
  const mapWidth = Math.max(1, legend.size[0] - 1)
  const mapHeight = Math.max(1, legend.size[1] - 1)
  const layerImageCache = new Map<string, HTMLImageElement>()
  const maskCanvasCache = new Map<string, HTMLCanvasElement>()

  function pixelToUV(pixel: { x: number; y: number }) {
    const u = THREE.MathUtils.clamp(pixel.x, 0, mapWidth) / mapWidth
    const v = THREE.MathUtils.clamp(pixel.y, 0, mapHeight) / mapHeight
    return { u, v }
  }

  const heightScale = options.heightScale ?? HEIGHT_SCALE_DEFAULT
  let currentHeightScale = heightScale
  const waterPercent = THREE.MathUtils.clamp(
    options.waterLevelPercent ?? WATER_PERCENT_DEFAULT,
    0,
    100
  )
  const waterHeight = THREE.MathUtils.mapLinear(waterPercent, 0, 100, WATER_MIN, WATER_MAX)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(43, width / height, 0.1, 100)
  camera.position.set(-5.2, 3.5, 6)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const upAxis = new THREE.Vector3(0, 1, 0)
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
  renderer.setSize(width, height)
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
  const markerResources: Array<{
    material: THREE.SpriteMaterial
    texture: THREE.Texture
    stemMaterial?: THREE.MeshStandardMaterial
    stemGeometry?: THREE.BufferGeometry
  }> = []
  const markerMap = new Map<
    string,
    { container: THREE.Group; sprite: THREE.Sprite; stem: THREE.Mesh }
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

  function clearMarkerResources() {
    markerResources.splice(0).forEach(({ material, texture, stemMaterial, stemGeometry }) => {
      material.dispose()
      texture.dispose()
      stemMaterial?.dispose()
      stemGeometry?.dispose()
    })
    markersGroup.clear()
    locationWorldCache.clear()
    markerMap.clear()
    markerInteractiveTargets.length = 0
  }

  function formatMarkerGlyph(location: TerrainLocation) {
    const raw = (location.icon || location.name || '?').trim()
    if (!raw) return '?'
    const first = raw[0]
    return /[a-zA-Z0-9]/.test(first) ? first.toUpperCase() : raw
  }

  function updateMarkerVisuals() {
    markerMap.forEach(({ sprite, stem }, id) => {
      const baseScale = 0.36
      const emphasis = currentFocusId === id ? 1.2 : hoveredLocationId === id ? 1.05 : 1
      sprite.scale.set(baseScale * emphasis, baseScale * 0.55 * emphasis, 1)
      sprite.material.opacity = currentFocusId === id ? 1 : hoveredLocationId === id ? 0.9 : 0.6
      const stemMat = stem.material as THREE.MeshStandardMaterial
      stemMat.opacity = currentFocusId === id ? 0.8 : hoveredLocationId === id ? 0.95 : 0.75
    })
  }

  function setLocationMarkers(locations: TerrainLocation[], focusedId?: string) {
    currentLocations = locations
    currentFocusId = focusedId
    clearMarkerResources()
    markerMap.clear()
    markerInteractiveTargets.length = 0
    if (!heightSampler || !locations.length) return
    locations.forEach((location) => {
      const { u, v } = pixelToUV(location.pixel)
      const world = uvToWorld(u, v, heightSampler, currentHeightScale, seaLevel)
      if (!world) return
      locationWorldCache.set(location.id, world.clone())
      const glyph = formatMarkerGlyph(location)
      const { material, texture } = createMarkerMaterial(glyph)
      const sprite = new THREE.Sprite(material)
      sprite.position.set(0, 0.32, 0)
      sprite.userData.locationId = location.id
      const stemHeight = Math.max(world.y - FLOOR_Y + 0.1, 0.4)
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, stemHeight, 6),
        new THREE.MeshStandardMaterial({
          color: 0xd9c39c,
          transparent: true,
          opacity: 0.75
        })
      )
      stem.position.y = -(stemHeight / 4)
      stem.userData.locationId = location.id
      const container = new THREE.Group()
      container.position.copy(world)
      container.userData.locationId = location.id
      container.add(stem)
      container.add(sprite)
      markersGroup.add(container)
      markerMap.set(location.id, { container, sprite, stem })
      markerInteractiveTargets.push(sprite, stem)
      markerResources.push({
        material,
        texture,
        stemMaterial: stem.material as THREE.MeshStandardMaterial,
        stemGeometry: stem.geometry
      } as any)
    })
    updateMarkerVisuals()
  }

  const loader = new THREE.TextureLoader()
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

  const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH, SEGMENTS_X, SEGMENTS_Z)
  terrainGeometry.rotateX(-Math.PI / 2)
  applyHeightField(terrainGeometry, sampler, { seaLevel, heightScale })

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

  const base = createBaseSlice()
  scene.add(base.mesh)

  const rimMesh = buildRimMesh(
    terrainGeometry,
    FLOOR_Y,
    new THREE.MeshStandardMaterial({
      color: 0x14121f,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide
    })
  )
  rimMesh.receiveShadow = true
  scene.add(rimMesh)

  const ocean = createOceanMesh(heightMap, sampler, heightScale, waterHeight, seaLevel)
  scene.add(ocean.mesh)

  disposables.push(() => {
    terrainGeometry.dispose()
    terrainMaterial.dispose()
    base.dispose()
    rimMesh.geometry.dispose()
    Array.isArray(rimMesh.material)
      ? rimMesh.material.forEach((mat) => mat.dispose())
      : rimMesh.material.dispose()
    ocean.dispose()
    heightMap.dispose()
    topoTexture.dispose()
    legendTexture?.dispose()
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
    renderer.setSize(clientWidth, clientHeight)
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
      const pixelX = Math.round(u * mapWidth)
      const pixelY = Math.round((1 - v) * mapHeight)
      options.onLocationPick?.({
        pixel: { x: pixelX, y: pixelY },
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
    navigateToLocation({
      pixel: {
        x: Math.round(hit.uv?.x ? hit.uv.x * mapWidth : worldPoint.x),
        y: Math.round(hit.uv?.y ? (1 - hit.uv.y) * mapHeight : worldPoint.z)
      },
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
      uvToWorld(
        pixelToUV(pixel).u,
        pixelToUV(pixel).v,
        heightSampler,
        currentHeightScale,
        seaLevel
      )
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
    })
  }
}
