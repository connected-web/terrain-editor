import * as THREE from 'three'

export type HeightSampler = {
  width: number
  height: number
  data: Float32Array
}

function getImageSize(img: HTMLImageElement | ImageBitmap) {
  if ('naturalWidth' in img) {
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }
  }
  return {
    width: img.width,
    height: img.height
  }
}

export function createHeightSampler(texture: THREE.Texture): HeightSampler | null {
  if (typeof document === 'undefined') return null
  const image = texture.image as HTMLImageElement | ImageBitmap | undefined
  if (!image) return null
  const { width, height } = getImageSize(image)
  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(image as CanvasImageSource, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  const data = new Float32Array(width * height)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = pixels[i * 4] / 255
  }
  return { width, height, data }
}

export function sampleHeightValue(sampler: HeightSampler, u: number, v: number) {
  const x = THREE.MathUtils.clamp(u, 0, 1) * (sampler.width - 1)
  const y = (1 - THREE.MathUtils.clamp(v, 0, 1)) * (sampler.height - 1)
  const x0 = Math.floor(x)
  const x1 = Math.min(sampler.width - 1, Math.ceil(x))
  const y0 = Math.floor(y)
  const y1 = Math.min(sampler.height - 1, Math.ceil(y))
  const tx = x - x0
  const ty = y - y0
  function idx(ix: number, iy: number) {
    return sampler.data[iy * sampler.width + ix]
  }
  const a = idx(x0, y0)
  const b = idx(x1, y0)
  const c = idx(x0, y1)
  const d = idx(x1, y1)
  const ab = a + (b - a) * tx
  const cd = c + (d - c) * tx
  return ab + (cd - ab) * ty
}

export function applyHeightField(
  geometry: THREE.PlaneGeometry,
  sampler: HeightSampler,
  options: { seaLevel: number; heightScale: number }
) {
  const { seaLevel, heightScale } = options
  const positions = geometry.attributes.position as THREE.BufferAttribute
  const uvs = geometry.attributes.uv as THREE.BufferAttribute
  let minY = Infinity
  let maxY = -Infinity

  for (let i = 0; i < positions.count; i += 1) {
    const u = uvs.getX(i)
    const v = uvs.getY(i)
    const sampled = sampleHeightValue(sampler, u, v)
    const worldY = (sampled - seaLevel) * heightScale
    positions.setY(i, worldY)
    minY = Math.min(minY, worldY)
    maxY = Math.max(maxY, worldY)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return { minY, maxY }
}

function collectBoundaryIndices(cols: number, rows: number) {
  const indices: number[] = []
  // north edge (positive z)
  for (let col = 0; col < cols; col += 1) indices.push((rows - 1) * cols + col)
  // east edge (positive x), exclude corners already added
  for (let row = rows - 2; row >= 0; row -= 1) indices.push(row * cols + (cols - 1))
  // south edge
  for (let col = cols - 2; col >= 0; col -= 1) indices.push(col)
  // west edge
  for (let row = 1; row < rows - 1; row += 1) indices.push(row * cols)
  return indices
}

export function buildRimMesh(
  geometry: THREE.PlaneGeometry,
  floorY: number,
  material?: THREE.Material
) {
  const positions = geometry.attributes.position as THREE.BufferAttribute
  const cols = geometry.parameters.widthSegments + 1
  const rows = geometry.parameters.heightSegments + 1
  const ring = collectBoundaryIndices(cols, rows)

  const rimPositions: number[] = []
  const rimNormals: number[] = []
  const rimIndices: number[] = []

  function getVertex(idx: number) {
    return new THREE.Vector3(positions.getX(idx), positions.getY(idx), positions.getZ(idx))
  }

  for (let i = 0; i < ring.length; i += 1) {
    const current = getVertex(ring[i])
    const next = getVertex(ring[(i + 1) % ring.length])
    const base = rimPositions.length / 3

    const verts = [
      current,
      next,
      new THREE.Vector3(next.x, floorY, next.z),
      new THREE.Vector3(current.x, floorY, current.z)
    ]

    verts.forEach((v) => rimPositions.push(v.x, v.y, v.z))

    const edgeDir = new THREE.Vector3().subVectors(next, current)
    const downDir = new THREE.Vector3().subVectors(
      new THREE.Vector3(current.x, floorY, current.z),
      current
    )
    const normal = new THREE.Vector3().crossVectors(edgeDir, downDir).normalize()
    if (!Number.isFinite(normal.x)) normal.set(0, 1, 0)
    for (let n = 0; n < 4; n += 1) {
      rimNormals.push(normal.x, normal.y, normal.z)
    }

    rimIndices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  const rimGeometry = new THREE.BufferGeometry()
  rimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3))
  rimGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(rimNormals, 3))
  rimGeometry.setIndex(rimIndices)

  const rimMaterial =
    material ||
    new THREE.MeshStandardMaterial({
      color: 0x14121f,
      roughness: 0.55,
      metalness: 0.2,
      side: THREE.DoubleSide
    })

  return new THREE.Mesh(rimGeometry, rimMaterial)
}
