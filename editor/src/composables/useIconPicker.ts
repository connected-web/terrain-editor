import { TerrainLocation } from "@connected-web/terrain-editor";
import { ensureLocationId } from "../utils/locations";
import { ref } from "vue";

const iconPickerTarget = ref<string | null>(null)
const iconLibraryInputRef = ref<HTMLInputElement | null>(null)
const pendingAssetReplacement = ref<{ path: string; originalName?: string } | null>(null)

export type IconPickerComposable = {
  iconPickerTarget: typeof iconPickerTarget
  iconLibraryInputRef: typeof iconLibraryInputRef
  pendingAssetReplacement: typeof pendingAssetReplacement
  openIconPicker: (location: TerrainLocation) => void
  closeIconPicker: () => void
}

export function useIconPicker(setAssetDialogFilter: (filter: string) => void): IconPickerComposable {
    
  function openIconPicker(location: TerrainLocation) {
    setAssetDialogFilter('icon')
    iconPickerTarget.value = ensureLocationId(location).id!
  }

  function closeIconPicker(): void {
    iconPickerTarget.value = null
    setAssetDialogFilter('')
    pendingAssetReplacement.value = null
  }

  return {
    iconPickerTarget,
    iconLibraryInputRef,
    pendingAssetReplacement,
    openIconPicker,
    closeIconPicker
  }
}
