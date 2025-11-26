import { reactive } from 'vue'
import { persistLocalSettings, readLocalSettings } from '../utils/storage'

export type LocalSettings = {
  cameraTracking: boolean
  openLocationsOnSelect: boolean
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  cameraTracking: true,
  openLocationsOnSelect: true
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
  }

  function persistSettings() {
    persistLocalSettings(localSettings)
  }

  return {
    localSettings,
    loadLocalSettings,
    persistSettings
  }
}
