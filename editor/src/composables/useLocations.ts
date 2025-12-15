import { computed, ref, watch, onUnmounted } from 'vue'
import type { LocationViewState, TerrainLocation } from '@connected-web/terrain-editor'
import {
  clampNumber,
  ensureLocationId,
  getPlacementStep,
  snapLocationValue
} from '../utils/locations'
import { useWorkspaceContext, useWorkspaceModel } from '../models/workspace'
import { playwrightLog } from '../utils/playwrightDebug'

export function useLocations() {
  playwrightLog('[useLocations] ========= COMPOSABLE INITIALIZED =========')
  const { workspaceForm, projectSnapshot } = useWorkspaceModel()
  const workspace = useWorkspaceContext()
  const locationsList = ref<TerrainLocation[]>([])
  const selectedLocationId = ref<string | null>(null)
  const pendingLocationSearch = ref<string | null>(null)
  playwrightLog('[useLocations] pendingLocationSearch initialized to:', pendingLocationSearch.value)
  const locationPickerOpen = ref(false)
  const pendingLocationId = ref<string | null>(null)
  const pendingLocationDraft = ref<TerrainLocation | null>(null)
  const locationsDragActive = ref(false)
  const interactive = ref(false)
  const cameraViewState = ref<LocationViewState>(getFallbackViewState())
  const cameraViewSource = ref<'default' | 'override' | 'handle'>('default')

  function setCameraViewStateRef(state: LocationViewState, source: 'default' | 'override' | 'handle') {
    cameraViewSource.value = source
    cameraViewState.value = state
  }

  // Listen for camera movement and update cameraViewState reactively
  let unsubscribeCameraMove: (() => void) | undefined
  watch(
    () => workspace.handle.value,
    (handle, _, onCleanup) => {
      if (unsubscribeCameraMove) {
        unsubscribeCameraMove()
        unsubscribeCameraMove = undefined
      }
      if (handle && typeof handle.onCameraMove === 'function') {
        const maybeCleanup = handle.onCameraMove((newState: LocationViewState) => {
          setCameraViewStateRef(newState, 'handle')
        })
        unsubscribeCameraMove = typeof maybeCleanup === 'function' ? maybeCleanup : () => {}
        if (cameraViewSource.value !== 'override') {
          setCameraViewStateRef(handle.getViewState(), 'handle')
        }
        onCleanup(() => {
          if (unsubscribeCameraMove) unsubscribeCameraMove()
        })
      }
    },
    { immediate: true }
  )
  onUnmounted(() => {
    if (unsubscribeCameraMove) unsubscribeCameraMove()
  })

  const activeLocation = computed(
    () => locationsList.value.find((location) => ensureLocationId(location).id === selectedLocationId.value) ?? null
  )
  const locationStepX = computed(() => getPlacementStep(workspaceForm.width))
  const locationStepY = computed(() => getPlacementStep(workspaceForm.height))

  function setActiveLocation(id: string | null) {
    selectedLocationId.value = id
  }

  function findLocationByNameOrId(search: string): TerrainLocation | null {
    if (!search) return null
    const normalized = search.toLowerCase().trim()

    playwrightLog('[useLocations][findLocationByNameOrId] search:', search, 'normalized:', normalized)
    console.log('[useLocations][findLocationByNameOrId] search:', search, 'normalized:', normalized)

    // First try exact ID match (case-insensitive)
    const byId = locationsList.value.find(loc => ensureLocationId(loc).id?.toLowerCase() === normalized)
    if (byId) {
      playwrightLog('[useLocations][findLocationByNameOrId] Matched by ID:', byId)
      console.log('[useLocations][findLocationByNameOrId] Matched by ID:', byId)
      return byId
    }

    // Then try exact name match (case-insensitive)
    const byExactName = locationsList.value.find(loc =>
      loc.name?.toLowerCase() === normalized
    )
    if (byExactName) {
      playwrightLog('[useLocations][findLocationByNameOrId] Matched by exact name:', byExactName)
      console.log('[useLocations][findLocationByNameOrId] Matched by exact name:', byExactName)
      return byExactName
    }

    // Finally try partial name match (case-insensitive)
    const byPartialName = locationsList.value.find(loc =>
      loc.name?.toLowerCase().includes(normalized)
    )
    if (byPartialName) {
      playwrightLog('[useLocations][findLocationByNameOrId] Matched by partial name:', byPartialName)
      console.log('[useLocations][findLocationByNameOrId] Matched by partial name:', byPartialName)
      return byPartialName
    }
    playwrightLog('[useLocations][findLocationByNameOrId] No match found for:', search)
    console.log('[useLocations][findLocationByNameOrId] No match found for:', search)
    return null
  }

  function setActiveLocationByNameOrId(search: string | null) {
    if (!search) {
      setActiveLocation(null)
      pendingLocationSearch.value = null
      return
    }

    playwrightLog('[useLocations] setActiveLocationByNameOrId called with:', search)
    playwrightLog('[useLocations] Current locations list length:', locationsList.value.length)

    // Try to find the location immediately
    const location = findLocationByNameOrId(search)
    if (location) {
      const id = ensureLocationId(location).id!
      playwrightLog('[useLocations] Found location:', location.name, 'with ID:', id)
      setActiveLocation(id)
      pendingLocationSearch.value = null
    } else {
      // If not found, store the search term to retry when locations are loaded
      playwrightLog('[useLocations] Location not found, storing as pending search:', search)
      pendingLocationSearch.value = search
    }
  }

  function ensureActiveLocationSelection() {
    if (!locationsList.value.length) {
      selectedLocationId.value = null
      return
    }
    // Don't auto-select if we have a pending location search
    if (pendingLocationSearch.value) {
      return
    }
    const ensured = locationsList.value.map((location) => ensureLocationId(location))
    if (!selectedLocationId.value || !ensured.some((location) => location.id === selectedLocationId.value)) {
      selectedLocationId.value = ensured[0].id ?? null
    }
  }

  function commitLocations() {
    const cloned = locationsList.value.map((location) => {
      const copy = ensureLocationId({ ...location })
      if (copy.showBorder === undefined) copy.showBorder = true
      return copy
    })
    locationsList.value = cloned
    workspace.projectStore.setLocations(cloned)
    workspace.handle.value?.updateLocations(
      workspace.getViewerLocations(cloned),
      selectedLocationId.value ?? undefined
    )
    ensureActiveLocationSelection()
    void workspace.persistCurrentProject()
  }

  function clampLocationPixel(location: TerrainLocation) {
    const width = workspaceForm.width
    const height = workspaceForm.height
    location.pixel.x = snapLocationValue(clampNumber(location.pixel.x ?? 0, 0, width), width)
    location.pixel.y = snapLocationValue(clampNumber(location.pixel.y ?? 0, 0, height), height)
    commitLocations()
  }

  function setLocations(list: TerrainLocation[]) {
    locationsList.value = list
    ensureActiveLocationSelection()
  }

  function openLocationPicker() {
    if (!locationsList.value.length) {
      return
    }
    locationPickerOpen.value = true
  }

  function closeLocationPicker() {
    locationPickerOpen.value = false
  }

  function focusLocationInViewer(id: string) {
    const handle = workspace.handle.value
    if (!handle) return
    const target = locationsList.value.find((location) => ensureLocationId(location).id === id)
    if (!target) return
    handle.setFocusedLocation?.(id)
    const pixel =
      target.pixel ?? {
        x: Math.round(workspaceForm.width / 2),
        y: Math.round(workspaceForm.height / 2)
      }
    const view = workspace.localSettings?.cameraTracking ? target.view : undefined
    handle.navigateTo({ pixel, locationId: id, view })
  }

  function setInteractiveMode(value: boolean) {
    interactive.value = value
    workspace.handle.value?.setInteractiveMode(value)
  }

  function isCameraFocusedOnLocation(location: TerrainLocation): boolean {
    if (!location) {
      console.log('No active location to compare to')
      return false
    }
    const viewState = cameraViewState.value
    const locationView = location?.view
    if (!locationView) {
      console.log('Active location has no view to compare to')
      return false
    }
    const epsilon = 0.05
    return (
      Math.abs(viewState.distance - locationView.distance) < epsilon &&
      Math.abs(viewState.polar - locationView.polar) < epsilon &&
      Math.abs(viewState.azimuth - locationView.azimuth) < epsilon
    )
  }

  function resetPlacementState() {
    pendingLocationDraft.value = null
    pendingLocationId.value = null
    setInteractiveMode(false)
  }

  function addLocation() {
    const legend = projectSnapshot.value.legend
    if (!legend) return
    const draft: TerrainLocation = ensureLocationId({
      id: '',
      name: `New location ${locationsList.value.length + 1}`,
      pixel: { x: 0, y: 0 },
      showBorder: true
    })
    pendingLocationDraft.value = draft
    pendingLocationId.value = '__pending-location__'
    setActiveLocation(null)
    setInteractiveMode(true)
    workspace.setActivePanel?.('locations')
    workspace.ensureDockExpanded?.()
    locationPickerOpen.value = false
    workspace.updateStatus?.('Click anywhere on the map to place the new location.')
  }

  function startPlacement(location: TerrainLocation) {
    if (!workspace.handle.value) return
    pendingLocationDraft.value = null
    const id = ensureLocationId(location).id!
    selectedLocationId.value = id
    pendingLocationId.value = id
    setInteractiveMode(true)
    workspace.updateStatus?.(`Click anywhere on the map to place ${location.name ?? 'this location'}.`)
  }

  function removeLocation(location: TerrainLocation) {
    locationsList.value = locationsList.value.filter((entry) => entry.id !== location.id)
    if (selectedLocationId.value === location.id) {
      selectedLocationId.value = locationsList.value[0]?.id ?? null
    }
    if (pendingLocationId.value === location.id) {
      resetPlacementState()
    }
    commitLocations()
  }

  function handleLocationPick(payload: { pixel: { x: number; y: number } }) {
    const snapped = {
      x: snapLocationValue(clampNumber(payload.pixel.x, 0, workspaceForm.width), workspaceForm.width),
      y: snapLocationValue(clampNumber(payload.pixel.y, 0, workspaceForm.height), workspaceForm.height)
    }
    if (pendingLocationId.value === '__pending-location__' && pendingLocationDraft.value) {
      const draft = ensureLocationId({ ...pendingLocationDraft.value, pixel: snapped })
      pendingLocationDraft.value = null
      pendingLocationId.value = null
      setInteractiveMode(false)
      locationsList.value = [...locationsList.value, draft]
      commitLocations()
      setActiveLocation(draft.id!)
      workspace.updateStatus?.(`Added ${draft.name ?? draft.id} at (${draft.pixel.x}, ${draft.pixel.y}).`)
      return
    }
    if (pendingLocationId.value) {
      const target = locationsList.value.find((location) => location.id === pendingLocationId.value)
      if (target) {
        target.pixel = snapped
        pendingLocationId.value = null
        setInteractiveMode(false)
        commitLocations()
        setActiveLocation(target.id!)
        workspace.updateStatus?.(`Placed ${target.name ?? target.id} at (${target.pixel.x}, ${target.pixel.y}).`)
        return
      }
    }
    workspace.updateStatus?.(`Picked pixel (${snapped.x}, ${snapped.y})`)
  }


  watch(
    () => projectSnapshot.value.locations,
    (snapshotLocations) => {
      playwrightLog('[useLocations WATCHER FIRED] snapshotLocations:', snapshotLocations ? `${snapshotLocations.length} items` : 'null/undefined')
      playwrightLog('[useLocations WATCHER FIRED] pendingLocationSearch at start:', pendingLocationSearch.value)
      playwrightLog('[useLocations WATCHER FIRED] selectedLocationId at start:', selectedLocationId.value)

      locationsList.value = snapshotLocations
        ? snapshotLocations.map((location) => {
            const copy = ensureLocationId({ ...location })
            if (copy.showBorder === undefined) copy.showBorder = true
            return copy
        })
        : []

      playwrightLog('[useLocations] Locations list updated, length:', locationsList.value.length)
      playwrightLog('[useLocations] Pending location search:', pendingLocationSearch.value)
      playwrightLog('[useLocations] Location names:', locationsList.value.map(l => l.name).join(', '))

      // Always try to resolve pending location search if present
      if (pendingLocationSearch.value && locationsList.value.length > 0) {
        playwrightLog('[useLocations] Attempting to resolve pending search:', pendingLocationSearch.value)
        console.log('[useLocations] Attempting to resolve pending search:', pendingLocationSearch.value)
        const location = findLocationByNameOrId(pendingLocationSearch.value)
        if (location) {
          const id = ensureLocationId(location).id!
          playwrightLog('[useLocations] Resolved pending search to location:', location.name, 'ID:', id)
          console.log('[useLocations] Resolved pending search to location:', location.name, 'ID:', id)
          pendingLocationSearch.value = null // Clear before setActiveLocation
          setActiveLocation(id)
        } else {
          playwrightLog('[useLocations] Could not resolve pending search:', pendingLocationSearch.value, 'Available:', locationsList.value.map(l => l.name))
          console.log('[useLocations] Could not resolve pending search:', pendingLocationSearch.value, 'Available:', locationsList.value.map(l => l.name))
        }
      } else {
        playwrightLog('[useLocations] Running ensureActiveLocationSelection (no pending search)')
        playwrightLog('[useLocations] Reason: pendingLocationSearch=', pendingLocationSearch.value, 'locationsList.length=', locationsList.value.length)
        console.log('[useLocations] Running ensureActiveLocationSelection (no pending search)')
        console.log('[useLocations] Reason: pendingLocationSearch=', pendingLocationSearch.value, 'locationsList.length=', locationsList.value.length)
        // Only run auto-selection if there's no pending search
        ensureActiveLocationSelection()
      }

      workspace.handle.value?.updateLocations(
        workspace.getViewerLocations(locationsList.value),
        selectedLocationId.value ?? undefined
      )
    },
    { deep: true, immediate: true }
  )

  let hasSyncedInitialLocationSelection = false
  let pendingCameraFocus: string | null = null

  watch(
    () => selectedLocationId.value,
    (id) => {
      if (id) {
        // Check if viewer is ready before focusing camera
        const viewerReady = workspace.viewerLifecycleState?.value === 'ready'
        playwrightLog('[useLocations] Location selected:', id, 'Viewer ready:', viewerReady)

        if (viewerReady) {
          // Viewer is ready, focus immediately
          focusLocationInViewer(id)
          pendingCameraFocus = null
        } else {
          // Viewer not ready, defer camera focus
          playwrightLog('[useLocations] Deferring camera focus until viewer is ready')
          pendingCameraFocus = id
        }

        if (hasSyncedInitialLocationSelection && workspace.localSettings?.openLocationsOnSelect) {
          workspace.setActivePanel?.('locations')
          workspace.ensureDockExpanded?.()
        }
      } else if (workspace.handle.value) {
        workspace.handle.value.updateLocations(workspace.getViewerLocations(), undefined)
        workspace.handle.value.setFocusedLocation?.(undefined)
        pendingCameraFocus = null
      }
      if (!hasSyncedInitialLocationSelection) {
        hasSyncedInitialLocationSelection = true
      }
    }
  )

  // Watch viewer lifecycle and trigger pending camera focus when ready
  watch(
    () => workspace.viewerLifecycleState?.value,
    (state) => {
      playwrightLog('[useLocations] Viewer lifecycle changed to:', state, 'Pending focus:', pendingCameraFocus)
      if (state === 'ready' && pendingCameraFocus) {
        playwrightLog('[useLocations] Viewer ready, focusing on pending location:', pendingCameraFocus)
        focusLocationInViewer(pendingCameraFocus)
        pendingCameraFocus = null
      }
    }
  )

  watch(
    () => workspace.localSettings?.cameraTracking,
    (enabled) => {
      if (enabled && selectedLocationId.value) {
        focusLocationInViewer(selectedLocationId.value)
      }
    }
  )

  watch(
    () => locationsList.value.length,
    (count) => {
      if (count === 0) {
        locationPickerOpen.value = false
      }
    }
  )

  watch(
    () => workspace.handle.value,
    (handle) => {
      if (!handle) return
      handle.updateLocations(
        workspace.getViewerLocations(locationsList.value),
        selectedLocationId.value ?? undefined
      )
    }
  )

  function getFallbackViewState(): LocationViewState {
    return (
      workspace.handle.value?.getViewState() ?? {
        distance: 1,
        polar: Math.PI / 3,
        azimuth: 0,
        targetPixel: {
          x: workspaceForm.width / 2,
          y: workspaceForm.height / 2
        }
      }
    )
  }

  function ensureLocationView(location: TerrainLocation) {
    if (!location.view) {
      location.view = { ...getFallbackViewState() }
    }
    return location.view
  }

  function updateActiveLocationViewField(key: keyof LocationViewState, rawValue: string | number) {
    const location = activeLocation.value
    if (!location) return
    if (rawValue === '' || rawValue === null) {
      location.view = undefined
      commitLocations()
      return
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const view = ensureLocationView(location)
    view[key] = parsed
    commitLocations()
  }

  function captureCameraViewForActiveLocation() {
    if (!workspace.handle.value || !activeLocation.value) return
    activeLocation.value.view = { ...workspace.handle.value.getViewState() }
    commitLocations()
    workspace.updateStatus?.(
      `Saved camera view for ${activeLocation.value.name ?? activeLocation.value.id}.`,
      1500
    )
  }

  function focusCameraOnActiveLocation() {
    if (!workspace.handle.value || !activeLocation.value) {
      console.log('No active location to focus on')
      return
    }
    const location = activeLocation.value
    workspace.handle.value.navigateTo({
      pixel: location.pixel ?? {
        x: Math.round(workspaceForm.width / 2),
        y: Math.round(workspaceForm.height / 2)
      },
      locationId: location.id!,
      view: location.view ?? undefined
    })
  }

  function clearActiveLocationView() {
    if (!activeLocation.value || !activeLocation.value.view) return
    activeLocation.value.view = undefined
    commitLocations()
  }

  function applyCameraViewOverride(state: LocationViewState) {
    setCameraViewStateRef(state, 'override')
  }

  return {
    locationsList,
    selectedLocationId,
    locationPickerOpen,
    pendingLocationId,
    pendingLocationDraft,
    locationsDragActive,
    activeLocation,
    locationStepX,
    locationStepY,
    setActiveLocation,
    setActiveLocationByNameOrId,
    findLocationByNameOrId,
    ensureActiveLocationSelection,
    commitLocations,
    clampLocationPixel,
    setLocations,
    addLocation,
    startPlacement,
    removeLocation,
    handleLocationPick,
    resetPlacementState,
    isCameraFocusedOnLocation,
    interactive,
    updateActiveLocationViewField,
    captureCameraViewForActiveLocation,
    clearActiveLocationView,
    focusCameraOnActiveLocation,
    openLocationPicker,
    closeLocationPicker,
    cameraViewState,
    applyCameraViewOverride
  }
}

export type LocationsApi = ReturnType<typeof useLocations>
