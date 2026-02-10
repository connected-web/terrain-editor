import { reactive } from 'vue'
import type {
  MarkerSpriteStateStyle,
  MarkerStemGeometryShape,
  MarkerStemStateStyle
} from '@connected-web/terrain-editor'

export type ThemeStateForm = {
  textColor: string
  backgroundColor: string
  borderColor: string
  borderThickness: number
  opacity: number
}

export type StemStateForm = {
  color: string
  opacity: number
}

export type SpriteStateKey = 'hover' | 'focus'
export type StemStateKey = 'hover' | 'focus'

export const stemShapeOptions: MarkerStemGeometryShape[] = [
  'cylinder',
  'triangle',
  'square',
  'pentagon',
  'hexagon'
]

export function createThemeStateForm(overrides?: Partial<ThemeStateForm>): ThemeStateForm {
  return {
    textColor: '#f2ede0',
    backgroundColor: '#0d1320',
    borderColor: '#f6e7c3',
    borderThickness: 1,
    opacity: 1,
    ...overrides
  }
}

export function assignThemeState(target: ThemeStateForm, source: ThemeStateForm | MarkerSpriteStateStyle) {
  target.textColor = source.textColor
  target.backgroundColor = source.backgroundColor
  target.borderColor = source.borderColor
  target.borderThickness = source.borderThickness
  target.opacity = source.opacity
}

export function createStemStateForm(overrides?: Partial<StemStateForm>): StemStateForm {
  return {
    color: '#f6e7c3',
    opacity: 0.85,
    ...overrides
  }
}

export function assignStemState(target: StemStateForm, source: StemStateForm | MarkerStemStateStyle) {
  target.color = source.color
  target.opacity = source.opacity
}

export function createThemeFormState() {
  return reactive({
    textColor: '#f2ede0',
    backgroundColor: '#0d1320',
    borderColor: '#f6e7c3',
    borderThickness: 1,
    opacity: 1,
    stemColor: '#f6e7c3',
    stemOpacity: 0.85,
    stemShape: 'cylinder' as MarkerStemGeometryShape,
    stemRadius: 0.015,
    stemHeightScale: 1,
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    maxFontSize: 16,
    minFontSize: 10,
    paddingX: 12,
    paddingY: 6,
    borderRadius: 12,
    iconScale: 1,
    fadeRange: 1,
    labelOffset: 0,
    hoverEnabled: false,
    focusEnabled: false,
    hover: createThemeStateForm(),
    focus: createThemeStateForm(),
    stemHoverEnabled: false,
    stemFocusEnabled: false,
    stemHover: createStemStateForm(),
    stemFocus: createStemStateForm()
  })
}

export function getSpriteStateRef(themeForm: ReturnType<typeof createThemeFormState>, key: SpriteStateKey) {
  return key === 'hover' ? themeForm.hover : themeForm.focus
}

export function getSpriteFlagKey(key: SpriteStateKey) {
  return key === 'hover' ? 'hoverEnabled' : 'focusEnabled'
}

export function getCurrentDefaultState(themeForm: ReturnType<typeof createThemeFormState>): ThemeStateForm {
  return createThemeStateForm({
    textColor: themeForm.textColor,
    backgroundColor: themeForm.backgroundColor,
    borderColor: themeForm.borderColor,
    borderThickness: themeForm.borderThickness,
    opacity: themeForm.opacity
  })
}

export function handleSpriteStateInput(
  themeForm: ReturnType<typeof createThemeFormState>,
  state: SpriteStateKey,
  onChange: () => void
) {
  const flag = getSpriteFlagKey(state)
  if (!themeForm[flag]) {
    themeForm[flag] = true
    assignThemeState(getSpriteStateRef(themeForm, state), getCurrentDefaultState(themeForm))
  }
  onChange()
}

export function resetSpriteState(
  themeForm: ReturnType<typeof createThemeFormState>,
  state: SpriteStateKey,
  onChange: () => void
) {
  const flag = getSpriteFlagKey(state)
  if (themeForm[flag]) {
    themeForm[flag] = false
  }
  assignThemeState(getSpriteStateRef(themeForm, state), getCurrentDefaultState(themeForm))
  onChange()
}

export function getStemStateRef(themeForm: ReturnType<typeof createThemeFormState>, key: StemStateKey) {
  return key === 'hover' ? themeForm.stemHover : themeForm.stemFocus
}

export function getStemFlagKey(key: StemStateKey) {
  return key === 'hover' ? 'stemHoverEnabled' : 'stemFocusEnabled'
}

export function getCurrentStemState(themeForm: ReturnType<typeof createThemeFormState>): StemStateForm {
  return createStemStateForm({
    color: themeForm.stemColor,
    opacity: themeForm.stemOpacity
  })
}

export function handleStemStateInput(
  themeForm: ReturnType<typeof createThemeFormState>,
  state: StemStateKey,
  onChange: () => void
) {
  const flag = getStemFlagKey(state)
  if (!themeForm[flag]) {
    themeForm[flag] = true
    assignStemState(getStemStateRef(themeForm, state), getCurrentStemState(themeForm))
  }
  onChange()
}

export function resetStemState(
  themeForm: ReturnType<typeof createThemeFormState>,
  state: StemStateKey,
  onChange: () => void
) {
  const flag = getStemFlagKey(state)
  if (themeForm[flag]) {
    themeForm[flag] = false
  }
  assignStemState(getStemStateRef(themeForm, state), getCurrentStemState(themeForm))
  onChange()
}
