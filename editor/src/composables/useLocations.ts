import { computed, ref, watch } from 'vue'
import type { TerrainLocation } from '@connected-web/terrain-editor'
import { clampNumber, ensureLocationId, getPlacementStep, snapLocationValue } from '../utils/locations'
import { useWorkspaceContext, useWorkspaceModel } from '../models/workspace'

export function useLocations() {
  const { workspaceForm } = useWorkspaceModel()
  const workspace = useWorkspaceContext()
  const locationsList = ref<TerrainLocation[]>([])
  const selectedLocationId = ref<string | null>(null)
  const locationPickerOpen = ref(false)
  const pendingLocationId = ref<string | null>(null)
  const pendingLocationDraft = ref<TerrainLocation | null>(null)
  const locationsDragActive = ref(false)

  const activeLocation = computed(() =>
    locationsList.value.find((location) => ensureLocationId(location).id === selectedLocationId.value) ?? null)
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

  watch(
    () => workspace.projectSnapshot.value,
    (snapshot) => {
      locationsList.value = snapshot.locations
        ? snapshot.locations.map((location) => {
            const copy = ensureLocationId({ ...location })
            if (copy.showBorder === undefined) copy.showBorder = true
            return copy
          })
        : []
      ensureActiveLocationSelection()
    },
    { immediate: true }
  )

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
    setLocations
  }
}
