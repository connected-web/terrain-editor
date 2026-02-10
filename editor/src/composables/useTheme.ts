import { ref, watch } from 'vue'
import { resolveTerrainTheme, type TerrainHandle, type TerrainThemeOverrides } from '@connected-web/terrain-editor'
import {
  assignStemState,
  assignThemeState,
  createThemeFormState,
  type SpriteStateKey,
  type StemStateKey
} from '../utils/theme'

export function useTheme(options: {
  projectSnapshot: { value: { theme?: TerrainThemeOverrides; legend?: unknown } }
  projectStore: { setTheme: (theme?: TerrainThemeOverrides) => void }
  handle: { value: TerrainHandle | null }
  persistCurrentProject: () => Promise<void>
}) {
  const baseThemeRef = ref<TerrainThemeOverrides | undefined>(undefined)
  const themeForm = createThemeFormState()
  let themeUpdateHandle: number | null = null

  function syncThemeFormFromSnapshot(snapshot = options.projectSnapshot.value) {
    const resolved = resolveTerrainTheme(snapshot.theme)
    const sprite = resolved.locationMarkers.sprite
    const spriteDefault = sprite.states.default
    themeForm.textColor = spriteDefault.textColor
    themeForm.backgroundColor = spriteDefault.backgroundColor
    themeForm.borderColor = spriteDefault.borderColor
    themeForm.borderThickness = spriteDefault.borderThickness
    themeForm.opacity = spriteDefault.opacity
    const stemDefault = resolved.locationMarkers.stem.states.default
    themeForm.stemColor = stemDefault.color
    themeForm.stemOpacity = stemDefault.opacity
    themeForm.stemShape = resolved.locationMarkers.stem.shape
    themeForm.fontFamily = sprite.fontFamily
    themeForm.fontWeight = sprite.fontWeight
    themeForm.maxFontSize = sprite.maxFontSize
    themeForm.minFontSize = sprite.minFontSize
    themeForm.paddingX = sprite.paddingX
    themeForm.paddingY = sprite.paddingY
    themeForm.borderRadius = sprite.borderRadius
    themeForm.iconScale = resolved.locationMarkers.iconScale ?? 1
    themeForm.fadeRange = resolved.locationMarkers.fadeRange ?? 1
    const sourceSprite = snapshot.theme?.locationMarkers?.sprite
    const hoverSource = sourceSprite?.states?.hover
    const focusSource = sourceSprite?.states?.focus
    themeForm.hoverEnabled = Boolean(hoverSource)
    themeForm.focusEnabled = Boolean(focusSource)
    assignThemeState(
      themeForm.hover,
      {
        textColor: hoverSource?.textColor ?? spriteDefault.textColor,
        backgroundColor: hoverSource?.backgroundColor ?? spriteDefault.backgroundColor,
        borderColor: hoverSource?.borderColor ?? spriteDefault.borderColor,
        borderThickness: hoverSource?.borderThickness ?? spriteDefault.borderThickness,
        opacity: hoverSource?.opacity ?? spriteDefault.opacity
      }
    )
    assignThemeState(
      themeForm.focus,
      {
        textColor: focusSource?.textColor ?? spriteDefault.textColor,
        backgroundColor: focusSource?.backgroundColor ?? spriteDefault.backgroundColor,
        borderColor: focusSource?.borderColor ?? spriteDefault.borderColor,
        borderThickness: focusSource?.borderThickness ?? spriteDefault.borderThickness,
        opacity: focusSource?.opacity ?? spriteDefault.opacity
      }
    )
    const sourceStem = snapshot.theme?.locationMarkers?.stem
    const stemHoverSource = sourceStem?.states?.hover
    const stemFocusSource = sourceStem?.states?.focus
    themeForm.stemHoverEnabled = Boolean(stemHoverSource)
    themeForm.stemFocusEnabled = Boolean(stemFocusSource)
    assignStemState(
      themeForm.stemHover,
      {
        color: stemHoverSource?.color ?? stemDefault.color,
        opacity: stemHoverSource?.opacity ?? stemDefault.opacity
      }
    )
    assignStemState(
      themeForm.stemFocus,
      {
        color: stemFocusSource?.color ?? stemDefault.color,
        opacity: stemFocusSource?.opacity ?? stemDefault.opacity
      }
    )
  }

  watch(
    () => options.projectSnapshot.value,
    (snapshot) => syncThemeFormFromSnapshot(snapshot),
    { immediate: true }
  )

  function commitThemeOverrides() {
    const overrides: TerrainThemeOverrides = {
      locationMarkers: {
        iconScale: themeForm.iconScale,
        fadeRange: themeForm.fadeRange,
        sprite: {
          fontFamily: themeForm.fontFamily,
          fontWeight: themeForm.fontWeight,
          maxFontSize: themeForm.maxFontSize,
          minFontSize: themeForm.minFontSize,
          paddingX: themeForm.paddingX,
          paddingY: themeForm.paddingY,
          borderRadius: themeForm.borderRadius,
          states: {
            default: {
              textColor: themeForm.textColor,
              backgroundColor: themeForm.backgroundColor,
              borderColor: themeForm.borderColor,
              borderThickness: themeForm.borderThickness,
              opacity: themeForm.opacity
            },
            ...(themeForm.hoverEnabled
              ? {
                  hover: {
                    textColor: themeForm.hover.textColor,
                    backgroundColor: themeForm.hover.backgroundColor,
                    borderColor: themeForm.hover.borderColor,
                    borderThickness: themeForm.hover.borderThickness,
                    opacity: themeForm.hover.opacity
                  }
                }
              : {}),
            ...(themeForm.focusEnabled
              ? {
                  focus: {
                    textColor: themeForm.focus.textColor,
                    backgroundColor: themeForm.focus.backgroundColor,
                    borderColor: themeForm.focus.borderColor,
                    borderThickness: themeForm.focus.borderThickness,
                    opacity: themeForm.focus.opacity
                  }
                }
              : {})
          }
        },
        stem: {
          shape: themeForm.stemShape,
          states: {
            default: {
              color: themeForm.stemColor,
              opacity: themeForm.stemOpacity
            },
            ...(themeForm.stemHoverEnabled
              ? {
                  hover: {
                    color: themeForm.stemHover.color,
                    opacity: themeForm.stemHover.opacity
                  }
                }
              : {}),
            ...(themeForm.stemFocusEnabled
              ? {
                  focus: {
                    color: themeForm.stemFocus.color,
                    opacity: themeForm.stemFocus.opacity
                  }
                }
              : {})
          }
        }
      }
    }
    options.projectStore.setTheme(overrides)
    options.handle.value?.setTheme(overrides)
    void options.persistCurrentProject()
  }

  function scheduleThemeUpdate() {
    if (themeUpdateHandle) {
      window.clearTimeout(themeUpdateHandle)
    }
    themeUpdateHandle = window.setTimeout(() => {
      themeUpdateHandle = null
      commitThemeOverrides()
    }, 250)
  }

  function cancelThemeUpdate() {
    if (themeUpdateHandle) {
      window.clearTimeout(themeUpdateHandle)
      themeUpdateHandle = null
    }
  }

  function resetThemeForm() {
    if (baseThemeRef.value) {
      options.projectStore.setTheme(JSON.parse(JSON.stringify(baseThemeRef.value)))
      options.handle.value?.setTheme(JSON.parse(JSON.stringify(baseThemeRef.value)))
    } else {
      options.projectStore.setTheme(undefined)
      options.handle.value?.setTheme(undefined)
    }
    syncThemeFormFromSnapshot()
    cancelThemeUpdate()
    void options.persistCurrentProject()
  }

  return {
    themeForm,
    baseThemeRef,
    syncThemeFormFromSnapshot,
    commitThemeOverrides,
    scheduleThemeUpdate,
    cancelThemeUpdate,
    resetThemeForm
  }
}
