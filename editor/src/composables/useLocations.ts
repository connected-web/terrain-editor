import { computed, ref, watch, onUnmounted } from 'vue'
import type { LocationViewState, TerrainLocation } from '@connected-web/terrain-editor'
import {
  clampNumber,
  ensureLocationId,
  getPlacementStep,
  snapLocationValue
} from '../utils/locations'
import { useWorkspaceContext, useWorkspaceModel } from '../models/workspace'

export function useLocations() {
  const { workspaceForm, projectSnapshot } = useWorkspaceModel()
  const workspace = useWorkspaceContext()
  const locationsList = ref<TerrainLocation[]>([])
  const selectedLocationId = ref<string | null>(null)
  const locationPickerOpen = ref(false)
  const pendingLocationId = ref<string | null>(null)
  const pendingLocationDraft = ref<TerrainLocation | null>(null)
  const locationsDragActive = ref(false)
  const interactive = ref(false)
  // --- Camera view state is now reactive ---
  const cameraViewState = ref<LocationViewState>(getFallbackViewState())

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
          cameraViewState.value = newState
        })
        unsubscribeCameraMove = typeof maybeCleanup === 'function' ? maybeCleanup : () => {}
        cameraViewState.value = handle.getViewState()
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

  function ensureActiveLocationSelection() {
    if (!locationsList.value.length) {
      selectedLocationId.value = null
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
    if (!locationsList.value.length) return
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
    handle.updateLocations(workspace.getViewerLocations(), id)
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
      locationsList.value = snapshotLocations
        ? snapshotLocations.map((location) => {
            const copy = ensureLocationId({ ...location })
            if (copy.showBorder === undefined) copy.showBorder = true
            return copy
          })
        : []
      ensureActiveLocationSelection()
      workspace.handle.value?.updateLocations(workspace.getViewerLocations(locationsList.value))
    },
    { deep: true, immediate: true }
  )

  watch(
    () => selectedLocationId.value,
    (id) => {
      if (id) {
        focusLocationInViewer(id)
        if (workspace.localSettings?.openLocationsOnSelect) {
          workspace.setActivePanel?.('locations')
          workspace.ensureDockExpanded?.()
        }
      } else if (workspace.handle.value) {
        workspace.handle.value.updateLocations(workspace.getViewerLocations())
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
        azimuth: 0
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
    cameraViewState
  }
}

export type LocationsApi = ReturnType<typeof useLocations>

