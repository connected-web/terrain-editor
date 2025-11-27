import { computed, ref } from 'vue'
import type { TerrainHandle, TerrainLocation } from '@connected-web/terrain-editor'
import { clampNumber, ensureLocationId, getPlacementStep, snapLocationValue } from '../utils/locations'

export function useLocations(options: {
  workspaceForm: { width: number; height: number }
  projectStore: { setLocations: (locations?: TerrainLocation[]) => void }
  handle: { value: TerrainHandle | null }
  getViewerLocations: (list?: TerrainLocation[]) => TerrainLocation[]
  persistCurrentProject: () => Promise<void>
}) {
  const locationsList = ref<TerrainLocation[]>([])
  const selectedLocationId = ref<string | null>(null)
  const locationPickerOpen = ref(false)
  const pendingLocationId = ref<string | null>(null)
  const pendingLocationDraft = ref<TerrainLocation | null>(null)
  const locationsDragActive = ref(false)

  const activeLocation = computed(() =>
    locationsList.value.find((location) => ensureLocationId(location).id === selectedLocationId.value) ?? null)
  const locationStepX = computed(() => getPlacementStep(options.workspaceForm.width))
  const locationStepY = computed(() => getPlacementStep(options.workspaceForm.height))

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
    options.projectStore.setLocations(cloned)
    options.handle.value?.updateLocations(options.getViewerLocations(cloned), selectedLocationId.value ?? undefined)
    ensureActiveLocationSelection()
    void options.persistCurrentProject()
  }

  function clampLocationPixel(location: TerrainLocation) {
    const width = options.workspaceForm.width
    const height = options.workspaceForm.height
    location.pixel.x = snapLocationValue(clampNumber(location.pixel.x ?? 0, 0, width), width)
    location.pixel.y = snapLocationValue(clampNumber(location.pixel.y ?? 0, 0, height), height)
    commitLocations()
  }

  function setLocations(list: TerrainLocation[]) {
    locationsList.value = list
    ensureActiveLocationSelection()
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
    setLocations
  }
}
