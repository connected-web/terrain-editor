import { buildWynArchive, type TerrainProjectSnapshot } from '@connected-web/terrain-editor'

export const STORAGE_KEY = 'ctw-editor-project-v2'
export const AUTO_RESTORE_KEY = 'ctw-editor-restore-enabled'
export const LOCAL_SETTINGS_KEY = 'ctw-editor-local-settings'

export type PersistedProject = {
  label: string
  archiveBase64: string
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function persistProjectSnapshot(
  snapshot: TerrainProjectSnapshot,
  options: { base64?: string; label?: string } = {}
) {
  if (!snapshot.legend) return null
  let base64 = options.base64
  if (!base64) {
    const blob = await buildWynArchive(snapshot)
    const buffer = await blob.arrayBuffer()
    base64 = arrayBufferToBase64(buffer)
  }
  const next: PersistedProject = {
    label: options.label ?? snapshot.metadata.label ?? 'Untitled terrain',
    archiveBase64: base64
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    localStorage.setItem(AUTO_RESTORE_KEY, '1')
  } catch (err) {
    console.warn('Failed to persist project', err)
  }
  return next
}

export function readPersistedProject(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedProject
  } catch (err) {
    console.warn('Failed to read persisted project', err)
    return null
  }
}

export function shouldAutoRestoreProject() {
  return localStorage.getItem(AUTO_RESTORE_KEY) !== '0'
}

export function setAutoRestoreEnabled(enabled: boolean) {
  try {
    localStorage.setItem(AUTO_RESTORE_KEY, enabled ? '1' : '0')
  } catch (err) {
    console.warn('Failed to update auto-restore flag', err)
  }
}

export function clearPersistedProject() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear persisted project', err)
  }
}

export function persistLocalSettings<T extends Record<string, unknown>>(settings: T) {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('Failed to persist local settings', err)
  }
}

export function readLocalSettings<T extends Record<string, unknown>>() {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn('Failed to read local settings', err)
    return null
  }
}
