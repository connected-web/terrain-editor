export type MaskStrokeMode = 'paint' | 'erase'

export type MaskStrokePoint = {
  x: number
  y: number
}

export type MaskStroke = {
  points: MaskStrokePoint[]
  radius: number
  strength?: number
  mode?: MaskStrokeMode
}

export type MaskImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type MaskEditorState = {
  width: number
  height: number
  dirty: boolean
  undoCount: number
  redoCount: number
}

export type MaskEditorHandle = {
  getState: () => MaskEditorState
  subscribe: (listener: (state: MaskEditorState) => void) => () => void
  applyStroke: (stroke: MaskStroke) => void
  clear: () => void
  undo: () => void
  redo: () => void
  exportMask: () => MaskImage
  loadMask: (mask: MaskImage) => void
  markClean: () => void
}

type MaskEditorOptions = {
  width: number
  height: number
  initialMask?: MaskImage
}

function createMask(width: number, height: number, fill = 0): MaskImage {
  const data = new Uint8ClampedArray(width * height)
  if (fill !== 0) data.fill(fill)
  return { width, height, data }
}

function cloneMask(mask: MaskImage): MaskImage {
  return {
    width: mask.width,
    height: mask.height,
    data: new Uint8ClampedArray(mask.data)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buffersEqual(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function createMaskEditor(options: MaskEditorOptions): MaskEditorHandle {
  const mask = options.initialMask
    ? cloneMask(options.initialMask)
    : createMask(options.width, options.height)
  let dirty = false
  let cleanCheckpoint = new Uint8ClampedArray(mask.data)
  const undoStack: Uint8ClampedArray[] = []
  const redoStack: Uint8ClampedArray[] = []
  const listeners = new Set<(state: MaskEditorState) => void>()

  function snapshot(): Uint8ClampedArray {
    return new Uint8ClampedArray(mask.data)
  }

  function updateDirtyFlag() {
    dirty = !buffersEqual(mask.data, cleanCheckpoint)
  }

  function emit() {
    const state: MaskEditorState = {
      width: mask.width,
      height: mask.height,
      dirty,
      undoCount: undoStack.length,
      redoCount: redoStack.length
    }
    listeners.forEach((listener) => listener(state))
  }

  function drawCircle(cx: number, cy: number, radius: number, delta: number) {
    const minX = clamp(Math.floor(cx - radius), 0, mask.width - 1)
    const maxX = clamp(Math.ceil(cx + radius), 0, mask.width - 1)
    const minY = clamp(Math.floor(cy - radius), 0, mask.height - 1)
    const maxY = clamp(Math.ceil(cy + radius), 0, mask.height - 1)
    const radiusSquared = radius * radius
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy > radiusSquared) continue
        const index = y * mask.width + x
        const next = clamp(mask.data[index] + delta, 0, 255)
        mask.data[index] = next
      }
    }
  }

  function drawStroke(stroke: MaskStroke) {
    if (!stroke.points.length) return
    const mode: MaskStrokeMode = stroke.mode ?? 'paint'
    const radius = Math.max(1, stroke.radius)
    const strength = clamp(stroke.strength ?? 1, 0, 1)
    const delta = Math.round(strength * 255) * (mode === 'erase' ? -1 : 1)
    const points = stroke.points
    drawCircle(points[0].x, points[0].y, radius, delta)
    for (let i = 1; i < points.length; i += 1) {
      const start = points[i - 1]
      const end = points[i]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const distance = Math.hypot(dx, dy)
      const step = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.5)))
      for (let s = 1; s <= step; s += 1) {
        const t = s / step
        const x = start.x + dx * t
        const y = start.y + dy * t
        drawCircle(x, y, radius, delta)
      }
    }
  }

  function applyStroke(stroke: MaskStroke) {
    if (!stroke.points.length) return
    undoStack.push(snapshot())
    redoStack.length = 0
    drawStroke(stroke)
    updateDirtyFlag()
    emit()
  }

  function clear() {
    undoStack.push(snapshot())
    redoStack.length = 0
    mask.data.fill(0)
    updateDirtyFlag()
    emit()
  }

  function undo() {
    if (!undoStack.length) return
    redoStack.push(snapshot())
    const previous = undoStack.pop()
    if (!previous) return
    mask.data.set(previous)
    updateDirtyFlag()
    emit()
  }

  function redo() {
    if (!redoStack.length) return
    undoStack.push(snapshot())
    const next = redoStack.pop()
    if (!next) return
    mask.data.set(next)
    updateDirtyFlag()
    emit()
  }

  function exportMask(): MaskImage {
    return cloneMask(mask)
  }

  function loadMask(next: MaskImage) {
    undoStack.length = 0
    redoStack.length = 0
    mask.width = next.width
    mask.height = next.height
    mask.data = new Uint8ClampedArray(next.data)
    cleanCheckpoint = new Uint8ClampedArray(mask.data)
    dirty = false
    emit()
  }

  function markClean() {
    cleanCheckpoint = new Uint8ClampedArray(mask.data)
    dirty = false
    emit()
  }

  function getState(): MaskEditorState {
    return {
      width: mask.width,
      height: mask.height,
      dirty,
      undoCount: undoStack.length,
      redoCount: redoStack.length
    }
  }

  function subscribe(listener: (state: MaskEditorState) => void) {
    listeners.add(listener)
    listener(getState())
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState,
    subscribe,
    applyStroke,
    clear,
    undo,
    redo,
    exportMask,
    loadMask,
    markClean
  }
}
