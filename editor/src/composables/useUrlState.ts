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
}

type InitialRouteState = {
  panel: DockPanel | null
  dockCollapsed: boolean | null
  layerId: string | null
  layerVisSignature: string | null
  cameraState: CameraState | null
  layerViewState: LayerViewState | null
}

const VALID_PANELS: DockPanel[] = ['workspace', 'layers', 'theme', 'settings', 'locations']

function parseInitialState(): InitialRouteState {
  if (typeof window === 'undefined') {
    return { panel: null, dockCollapsed: null, layerId: null, layerVisSignature: null, cameraState: null, layerViewState: null }
  }
  const params = new URLSearchParams(window.location.search)
  const panelParam = params.get('panel')
  const panel = VALID_PANELS.includes(panelParam as DockPanel) ? (panelParam as DockPanel) : null
  const dockParam = params.get('dock')
  const dockCollapsed =
    dockParam === '1' ? true : dockParam === '0' ? false : dockParam === null ? null : Boolean(dockParam)
  const layerId = params.get('layer')
  const layerVisSignature = params.get('layers')
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
      layerViewState = { zoom, centerX, centerY }
    }
  }
  return {
    panel,
    dockCollapsed,
    layerId,
    layerVisSignature,
    cameraState,
    layerViewState
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

function applySequentialVisibility(signature: string, entries: LayerEntry[], store: LayerBrowserStore) {
  if (!signature.length) return false
  const cleaned = signature.startsWith('LS:') ? signature.slice(3) : signature
  if (!cleaned.length) return false
  if (cleaned.length !== entries.length) return false
  let applied = false
  for (let index = 0; index < cleaned.length && index < entries.length; index += 1) {
    const flag = parseVisibilityToken(cleaned[index])
    if (flag === null) continue
    store.setVisibility(entries[index].id, flag)
    applied = true
  }
  return applied
}

function encodeLayerVisibility(entries: LayerEntry[]): string {
  if (!entries.length) return ''
  const signature = entries.map((entry) => (entry.visible ? 'V' : 'H')).join('')
  return `LS:${signature}`
}

function updateQueryParam(name: string, value: string | null, params: URLSearchParams) {
  if (!value) {
    params.delete(name)
    return
  }
  params.set(name, value)
}

export function useUrlState(options: Options) {
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
  const pendingLayerId = ref<string | null>(initial.layerId)
  const pendingLayerVisibility = ref<string | null>(initial.layerVisSignature)
  const layerVisibilitySignature = computed(() =>
    options.layerEntries.value.map((entry) => (entry.visible ? '1' : '0')).join('')
  )
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
        const applied = signature.startsWith('LS:') || /^[01VHvh]+$/.test(signature)
          ? applySequentialVisibility(signature, entries, options.layerBrowserStore)
          : signature.includes(':') ||
            signature.includes(',') ||
            signature.includes(';') ||
            signature.includes('|')
          ? applyPairVisibility(signature, entries, options.layerBrowserStore)
          : applySequentialVisibility(signature, entries, options.layerBrowserStore)
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
    const visibilityString = encodeLayerVisibility(options.layerEntries.value)
    updateQueryParam('layers', visibilityString || null, params)
    updateQueryParam('camera', cameraSignature.value || null, params)
    updateQueryParam('leo', layerViewStateSignature.value || null, params)
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
      layerViewStateSignature
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
}
