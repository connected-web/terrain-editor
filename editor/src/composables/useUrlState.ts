import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { LayerBrowserStore } from '@connected-web/terrain-editor'
import type { LayerEntry } from './useLayersModel'
import type { DockPanel } from '../models/workspace'

type CameraState = {
  distance: number
  polar: number
  azimuth: number
  targetPixel?: { x: number; y: number }
}

type LayerViewState = {
  zoom: number
  centerX: number
  centerY: number
}

type Options = {
  activePanel: Ref<DockPanel>
  setActivePanel: (panel: DockPanel) => void
  isDockCollapsed: Ref<boolean>
  layerEditorOpen: Ref<boolean>
  layerEditorSelectedLayerId: Ref<string | null>
  openLayerEditor: (id: string) => void
  layerEntries: ComputedRef<LayerEntry[]>
  layerBrowserStore: LayerBrowserStore
  cameraViewState: Ref<CameraState>
  setCameraViewState: (state: CameraState) => void
  layerViewState: Ref<LayerViewState | null>
  setPendingLayerViewState: (payload: { id: string | null; state: LayerViewState | null }) => void
  setOnionState?: (id: string, enabled: boolean) => void
  maskViewMode?: Ref<'grayscale' | 'color'>
}

type InitialRouteState = {
  panel: DockPanel | null
  dockCollapsed: boolean | null
  layerId: string | null
  layerVisSignature: string | null
  cameraState: CameraState | null
  layerViewState: LayerViewState | null
  locationId: string | null
  maskViewMode: 'grayscale' | 'color' | null
}

const VALID_PANELS: DockPanel[] = ['workspace', 'layers', 'theme', 'settings', 'locations', 'assets']

function extractMaskViewState(signature: string | null): {
  signature: string | null
  maskViewMode: 'grayscale' | 'color' | null
} {
  if (!signature) return { signature, maskViewMode: null }
  const suffixMatch = signature.match(/:(BW|CL)$/i)
  if (!suffixMatch) return { signature, maskViewMode: null }
  const base = signature.slice(0, -suffixMatch[0].length)
  const sequentialPattern = /^LS:[0-9A-Z]*$/i
  const compactPattern = /^[01VHOI]+$/i
  if (!sequentialPattern.test(base) && !compactPattern.test(base)) {
    return { signature, maskViewMode: null }
  }
  const token = suffixMatch[1].toUpperCase()
  const maskViewMode = token === 'CL' ? 'color' : 'grayscale'
  return { signature: base, maskViewMode }
}

function parseInitialState(): InitialRouteState {
  if (typeof window === 'undefined') {
    return {
      panel: null,
      dockCollapsed: null,
      layerId: null,
      layerVisSignature: null,
      cameraState: null,
      layerViewState: null,
      locationId: null,
      maskViewMode: null
    }
  }
  const params = new URLSearchParams(window.location.search)
  const panelParam = params.get('panel')
  const panel = VALID_PANELS.includes(panelParam as DockPanel) ? (panelParam as DockPanel) : null
  const dockParam = params.get('dock')
  const dockCollapsed =
    dockParam === '1' ? true : dockParam === '0' ? false : dockParam === null ? null : Boolean(dockParam)
  const layerId = params.get('layer')
  const rawLayerSignature = params.get('layers')
  const { signature: layerVisSignature, maskViewMode } = extractMaskViewState(rawLayerSignature)
  const cameraParam = params.get('camera')
  let cameraState: CameraState | null = null
  if (cameraParam) {
    const parts = cameraParam.split(',').map((value) => Number(value))
    if (parts.length >= 3) {
      const [distanceRaw, polarRaw, azimuthRaw, xRaw, yRaw] = parts
      const distance = Number.isFinite(distanceRaw) ? distanceRaw : 1
      const polar = Number.isFinite(polarRaw) ? polarRaw : Math.PI / 3
      const azimuth = Number.isFinite(azimuthRaw) ? azimuthRaw : 0
      const targetPixel =
        Number.isFinite(xRaw) && Number.isFinite(yRaw)
          ? { x: xRaw, y: yRaw }
          : undefined
      cameraState = {
        distance,
        polar,
        azimuth,
        targetPixel
      }
    }
  }
  const layerViewParam = params.get('leo')
  let layerViewState: LayerViewState | null = null
  if (layerViewParam) {
    const parts = layerViewParam.split(',').map((value) => Number(value))
    if (parts.length >= 3) {
      const [zoomRaw, centerXRaw, centerYRaw] = parts
      const zoom = Number.isFinite(zoomRaw) ? zoomRaw : 1
      const centerX = Number.isFinite(centerXRaw) ? centerXRaw : 0.5
      const centerY = Number.isFinite(centerYRaw) ? centerYRaw : 0.5
      if (centerX <= 0.001 && centerY <= 0.001) {
        layerViewState = null
      } else {
        layerViewState = { zoom, centerX, centerY }
      }
    }
  }
  const locationId = params.get('location')
  return {
    panel,
    dockCollapsed,
    layerId,
    layerVisSignature,
    cameraState,
    layerViewState,
    locationId,
    maskViewMode
  }
}

function parseVisibilityToken(token: string): boolean | null {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return null
  if (['1', 'true', 'on', 'yes', 'show', 'visible', 'v'].includes(normalized)) return true
  if (['0', 'false', 'off', 'no', 'hide', 'hidden', 'h'].includes(normalized)) return false
  return null
}

function resolveEntryId(token: string, entries: LayerEntry[]): string | null {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return null
  const directMatch = entries.find((entry) => entry.id.toLowerCase() === normalized)
  if (directMatch) return directMatch.id
  const suffixMatch = entries.find((entry) => entry.id.split(':')[1]?.toLowerCase() === normalized)
  return suffixMatch ? suffixMatch.id : null
}

function applyPairVisibility(signature: string, entries: LayerEntry[], store: LayerBrowserStore) {
  const segments = signature.split(/[;,|]/).map((segment) => segment.trim()).filter(Boolean)
  let applied = false
  for (const segment of segments) {
    const [rawKey, rawValue] = segment.split(':')
    if (!rawKey || !rawValue) continue
    const id = resolveEntryId(rawKey, entries)
    if (!id) continue
    const visibility = parseVisibilityToken(rawValue)
    if (visibility === null) continue
    store.setVisibility(id, visibility)
    applied = true
  }
  return applied
}

type LayerStatePatch = { visibility: boolean | null; onion: boolean | null }

function decodeLayerStateToken(token: string): LayerStatePatch | null {
  if (!token) return null
  const normalized = token.toUpperCase()
  switch (normalized) {
    case '1':
      return { visibility: true, onion: null }
    case '0':
      return { visibility: false, onion: null }
    case 'V':
      return { visibility: true, onion: false }
    case 'H':
      return { visibility: false, onion: false }
    case 'O':
      return { visibility: true, onion: true }
    case 'I':
      return { visibility: false, onion: true }
    default:
      return null
  }
}

function layerEntryStateToken(entry: LayerEntry): 'V' | 'H' | 'O' | 'I' {
  const onion = Boolean(entry.onionEnabled)
  if (entry.visible) {
    return onion ? 'O' : 'V'
  }
  return onion ? 'I' : 'H'
}

function applySequentialVisibility(
  signature: string,
  entries: LayerEntry[],
  store: LayerBrowserStore,
  setOnionState?: (id: string, enabled: boolean) => void
) {
  if (!signature.length) return false
  const cleaned = signature.startsWith('LS:') ? signature.slice(3) : signature
  if (!cleaned.length) return false
  if (cleaned.length !== entries.length) return false
  let applied = false
  for (let index = 0; index < cleaned.length && index < entries.length; index += 1) {
    const patch = decodeLayerStateToken(cleaned[index])
    if (!patch) continue
    if (patch.visibility !== null) {
      store.setVisibility(entries[index].id, patch.visibility)
      applied = true
    }
    if (setOnionState && patch.onion !== null) {
      setOnionState(entries[index].id, patch.onion)
      applied = true
    }
  }
  return applied
}

function encodeLayerVisibility(entries: LayerEntry[], maskViewMode?: 'grayscale' | 'color'): string {
  if (!entries.length) return ''
  const signature = entries.map((entry) => layerEntryStateToken(entry)).join('')
  const suffix = maskViewMode === 'color' ? ':CL' : ':BW'
  return `LS:${signature}${suffix}`
}

function updateQueryParam(name: string, value: string | null, params: URLSearchParams) {
  if (!value) {
    params.delete(name)
    return
  }
  params.set(name, value)
}

export function useUrlState(options: Options & { setActiveLocation?: (id: string | null) => void, selectedLocationId?: Ref<string | null> }) {
  if (typeof window === 'undefined') {
    return
  }
  const initial = parseInitialState()
  if (initial.panel) {
    options.setActivePanel(initial.panel)
  }
  if (initial.dockCollapsed !== null) {
    options.isDockCollapsed.value = initial.dockCollapsed
  }
  if (initial.cameraState) {
    options.setCameraViewState(initial.cameraState)
  }
  options.setPendingLayerViewState({
    id: initial.layerId,
    state: initial.layerViewState
  })
  if (initial.locationId && options.setActiveLocation) {
    options.setActiveLocation(initial.locationId)
  }
  if (initial.maskViewMode && options.maskViewMode) {
    options.maskViewMode.value = initial.maskViewMode
  }
  const pendingLayerId = ref<string | null>(initial.layerId)
  const pendingLayerVisibility = ref<string | null>(initial.layerVisSignature)
  const pendingLocationId = ref<string | null>(initial.locationId)
  const layerVisibilitySignature = computed(() => {
    const layers = options.layerEntries.value.map((entry) => layerEntryStateToken(entry)).join('')
    const maskMode = options.maskViewMode?.value ?? 'grayscale'
    return `${layers}|${maskMode}`
  })
  const cameraSignature = computed(() => {
    const state = options.cameraViewState.value
    if (!state) return ''
    const parts = [
      Number.isFinite(state.distance) ? state.distance.toFixed(3) : '0',
      Number.isFinite(state.polar) ? state.polar.toFixed(3) : '0',
      Number.isFinite(state.azimuth) ? state.azimuth.toFixed(3) : '0'
    ]
    if (state.targetPixel) {
      parts.push(
        Number.isFinite(state.targetPixel.x) ? state.targetPixel.x.toFixed(1) : '0',
        Number.isFinite(state.targetPixel.y) ? state.targetPixel.y.toFixed(1) : '0'
      )
    }
    return parts.join(',')
  })
  const layerViewStateSignature = computed(() => {
    if (!options.layerEditorOpen.value) return ''
    const layerId = options.layerEditorSelectedLayerId.value
    const state = options.layerViewState.value
    if (!layerId || !state) return ''
    return [
      Number.isFinite(state.zoom) ? state.zoom.toFixed(3) : '1',
      Number.isFinite(state.centerX) ? state.centerX.toFixed(4) : '0.5000',
      Number.isFinite(state.centerY) ? state.centerY.toFixed(4) : '0.5000'
    ].join(',')
  })

  watch(
    () => options.layerEntries.value,
    (entries) => {
      if (pendingLayerVisibility.value) {
        const signature = pendingLayerVisibility.value
        const applied = signature.startsWith('LS:') || /^[01VHOIvhoi]+$/.test(signature)
          ? applySequentialVisibility(signature, entries, options.layerBrowserStore, options.setOnionState)
          : signature.includes(':') ||
            signature.includes(',') ||
            signature.includes(';') ||
            signature.includes('|')
          ? applyPairVisibility(signature, entries, options.layerBrowserStore)
          : applySequentialVisibility(signature, entries, options.layerBrowserStore, options.setOnionState)
        if (applied) {
          pendingLayerVisibility.value = null
        }
      }
      if (pendingLayerId.value && entries.some((entry) => entry.id === pendingLayerId.value)) {
        options.openLayerEditor(pendingLayerId.value)
        pendingLayerId.value = null
      }
    },
    { immediate: true }
  )

  let suppressUpdates = true
  nextTick(() => {
    suppressUpdates = false
    syncUrl()
  })

  let pendingSyncHandle: number | null = null
  const SYNC_DELAY = 500

  function scheduleSync() {
    if (suppressUpdates) return
    if (pendingSyncHandle !== null) {
      window.clearTimeout(pendingSyncHandle)
    }
    pendingSyncHandle = window.setTimeout(() => {
      pendingSyncHandle = null
      syncUrl()
    }, SYNC_DELAY)
  }

  function syncUrl() {
    if (suppressUpdates) return
    const params = new URLSearchParams(window.location.search)
    updateQueryParam(
      'panel',
      options.activePanel.value !== 'workspace' ? options.activePanel.value : null,
      params
    )
    updateQueryParam('dock', options.isDockCollapsed.value ? '1' : null, params)
    const layerId =
      options.layerEditorOpen.value && options.layerEditorSelectedLayerId.value
        ? options.layerEditorSelectedLayerId.value
        : null
    updateQueryParam('layer', layerId, params)
    const visibilityString = encodeLayerVisibility(
      options.layerEntries.value,
      options.maskViewMode?.value
    )
    updateQueryParam('layers', visibilityString || null, params)
    updateQueryParam('camera', cameraSignature.value || null, params)
    updateQueryParam('leo', layerViewStateSignature.value || null, params)
    // Only sync location if we don't have a pending location resolution
    if (options.selectedLocationId && !pendingLocationId.value) {
      updateQueryParam('location', options.selectedLocationId.value || null, params)
    }
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }

  watch(
    [
      options.activePanel,
      options.isDockCollapsed,
      () => options.layerEditorOpen.value,
      () => options.layerEditorSelectedLayerId.value,
      layerVisibilitySignature,
      cameraSignature,
      layerViewStateSignature,
      () => options.selectedLocationId?.value
    ],
    () => scheduleSync(),
    { deep: false }
  )

  watch(
    () => options.layerEditorOpen.value,
    (open) => {
      if (!open) {
        pendingLayerId.value = null
      }
    }
  )

  watch(
    () => options.layerEditorSelectedLayerId.value,
    (id) => {
      if (!options.layerEditorOpen.value) {
        pendingLayerId.value = null
      } else if (id) {
        pendingLayerId.value = id
      }
    }
  )

  // Clear pending location when a location is successfully selected
  watch(
    () => options.selectedLocationId?.value,
    (id) => {
      if (id && pendingLocationId.value) {
        pendingLocationId.value = null
      }
    }
  )
}
