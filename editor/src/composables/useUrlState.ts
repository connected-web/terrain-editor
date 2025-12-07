import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { LayerBrowserStore } from '@connected-web/terrain-editor'
import type { LayerEntry } from './useLayersModel'
import type { DockPanel } from '../models/workspace'

type Options = {
  activePanel: Ref<DockPanel>
  setActivePanel: (panel: DockPanel) => void
  isDockCollapsed: Ref<boolean>
  layerEditorOpen: Ref<boolean>
  layerEditorSelectedLayerId: Ref<string | null>
  openLayerEditor: (id: string) => void
  layerEntries: ComputedRef<LayerEntry[]>
  layerBrowserStore: LayerBrowserStore
}

type InitialRouteState = {
  panel: DockPanel | null
  dockCollapsed: boolean | null
  layerId: string | null
  layerVisSignature: string | null
}

const VALID_PANELS: DockPanel[] = ['workspace', 'layers', 'theme', 'settings', 'locations']

function parseInitialState(): InitialRouteState {
  if (typeof window === 'undefined') {
    return { panel: null, dockCollapsed: null, layerId: null, layerVisSignature: null }
  }
  const params = new URLSearchParams(window.location.search)
  const panelParam = params.get('panel')
  const panel = VALID_PANELS.includes(panelParam as DockPanel) ? (panelParam as DockPanel) : null
  const dockParam = params.get('dock')
  const dockCollapsed =
    dockParam === '1' ? true : dockParam === '0' ? false : dockParam === null ? null : Boolean(dockParam)
  const layerId = params.get('layer')
  const layerVisSignature = params.get('layers')
  return {
    panel,
    dockCollapsed,
    layerId,
    layerVisSignature
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
  const pendingLayerId = ref<string | null>(initial.layerId)
  const pendingLayerVisibility = ref<string | null>(initial.layerVisSignature)
  const layerVisibilitySignature = computed(() =>
    options.layerEntries.value.map((entry) => (entry.visible ? '1' : '0')).join('')
  )

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
      layerVisibilitySignature
    ],
    () => syncUrl(),
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
