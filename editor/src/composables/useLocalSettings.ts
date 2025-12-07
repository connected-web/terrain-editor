import { reactive, watch } from 'vue'
import { persistLocalSettings, readLocalSettings } from '../utils/storage'

export type LocalSettings = {
  cameraTracking: boolean
  openLocationsOnSelect: boolean
  showLayerTransparencyGrid: boolean
  layerPreviewLuminance: boolean
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  cameraTracking: true,
  openLocationsOnSelect: true,
  showLayerTransparencyGrid: true,
  layerPreviewLuminance: true
}

export function useLocalSettings() {
  const localSettings = reactive<LocalSettings>({ ...DEFAULT_LOCAL_SETTINGS })

  function loadLocalSettings() {
    const saved = readLocalSettings<Partial<LocalSettings>>()
    if (!saved) return
    localSettings.cameraTracking =
      saved.cameraTracking ?? DEFAULT_LOCAL_SETTINGS.cameraTracking
    localSettings.openLocationsOnSelect =
      saved.openLocationsOnSelect ?? DEFAULT_LOCAL_SETTINGS.openLocationsOnSelect
    localSettings.showLayerTransparencyGrid =
      saved.showLayerTransparencyGrid ?? DEFAULT_LOCAL_SETTINGS.showLayerTransparencyGrid
    localSettings.layerPreviewLuminance =
      saved.layerPreviewLuminance ?? DEFAULT_LOCAL_SETTINGS.layerPreviewLuminance
  }

  function persistSettings() {
    persistLocalSettings(localSettings)
  }

  watch(
    () => [
      localSettings.cameraTracking,
      localSettings.openLocationsOnSelect,
      localSettings.showLayerTransparencyGrid,
      localSettings.layerPreviewLuminance
    ],
    () => persistSettings()
  )

  return {
    localSettings,
    loadLocalSettings,
    persistSettings
  }
}
