import { reactive, watch } from 'vue'
import { persistLocalSettings, readLocalSettings } from '../utils/storage'

export type BrushPreset = {
  id: string
  label: string
  settings: {
    size: number
    opacity: number
    softness: number
    spacing: number
    flow: number
  }
}

export type BrushSettings = {
  presetId: string
  toolSettings: {
    brush: { size: number; opacity: number; softness: number; spacing: number; flow: number }
    erase: { size: number; opacity: number; softness: number; spacing: number; flow: number }
    flat: { size: number; opacity: number; softness: number; spacing: number; flow: number; level: number }
    fill: { level: number; tolerance: number }
  }
  pins: { size: boolean; opacity: boolean; level: boolean }
  pinnedValues: { size: number; opacity: number; level: number }
}

export type LocalSettings = {
  cameraTracking: boolean
  openLocationsOnSelect: boolean
  brushSettings: BrushSettings | null
  brushPresets: BrushPreset[]
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  cameraTracking: true,
  openLocationsOnSelect: true,
  brushSettings: null,
  brushPresets: []
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
    localSettings.brushSettings =
      saved.brushSettings ?? DEFAULT_LOCAL_SETTINGS.brushSettings
    localSettings.brushPresets =
      saved.brushPresets ?? DEFAULT_LOCAL_SETTINGS.brushPresets
  }

  function persistSettings() {
    persistLocalSettings(localSettings)
  }

  watch(
    () => localSettings,
    () => persistSettings(),
    { deep: true }
  )

  return {
    localSettings,
    loadLocalSettings,
    persistSettings
  }
}
