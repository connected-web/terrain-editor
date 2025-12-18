export type OverlaySlot =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center'

export type UIActionSlot = 'toolbar' | 'overlay-center' | OverlaySlot

export type UIAction = {
  id: string
  icon: string
  label: string
  description?: string
  slot?: UIActionSlot
  disabled?: boolean
  callback: () => void
}
