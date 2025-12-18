<template>
  <div class="editor-viewer" ref="rootRef">
    <div class="editor-viewer__toolbar" v-if="toolbarActions.length">
      <button
        v-for="action in toolbarActions"
        :key="action.id"
        type="button"
        class="editor-viewer__toolbar-button"
        :title="action.description || action.label"
        :aria-label="action.label"
        :disabled="action.disabled"
        @click="action.callback()"
      >
        <Icon :icon="action.icon" class="editor-viewer__toolbar-icon">
          <span v-if="showLabels" class="editor-viewer__toolbar-label">{{ action.label }}</span>
        </Icon>
      </button>
    </div>
    <div
      ref="viewerRef"
      class="editor-viewer__canvas"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    ></div>
    <div v-if="isDragActive" class="editor-viewer__drop-overlay">
      Drop .wyn to load
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept=".wyn"
      class="editor-viewer__file-input"
      @change="handleFileInputChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createViewerOverlay,
  type ViewerOverlayHandle,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import type { UIAction } from '../types/uiActions'

const props = defineProps<{
  status: string
  statusFade?: boolean
  uiActions: UIAction[]
  showToolbarLabels?: boolean
}>()

const emit = defineEmits<{
  loadFile: [File]
  toggleFullscreen: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const viewerRef = ref<HTMLElement | null>(null)
const overlayHandle = ref<ViewerOverlayHandle | null>(null)
const showLabels = computed(() => props.showToolbarLabels ?? true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragActive = ref(false)
const dragDepth = ref(0)

const toolbarActions = computed(() =>
  (props.uiActions ?? []).filter((action) => (action.slot ?? 'toolbar') === 'toolbar')
)

const overlayActions = computed(() =>
  (props.uiActions ?? []).filter((action) => action.slot && action.slot !== 'toolbar')
)

function buildOptions() {
  return {
    status: {
      initialText: props.status
    },
    selectFile: {
      enabled: false
    },
    popout: {
      enabled: false
    },
    fullscreen: {
      enabled: false,
      displayInEmbed: false
    },
    customButtons: overlayActions.value.map((action) => ({
      location: action.slot === 'overlay-center' ? ('center' as const) : ((action.slot ??
        'top-left') as
        | 'top-left'
        | 'top-right'
        | 'top-center'
        | 'bottom-left'
        | 'bottom-right'
        | 'bottom-center'
        | 'center'),
      label: action.label,
      description: action.description,
      callback: action.disabled ? undefined : action.callback
    }))
  }
}

function setupOverlay() {
  if (!viewerRef.value) return
  overlayHandle.value?.destroy()
  overlayHandle.value = createViewerOverlay(viewerRef.value, buildOptions())
  overlayHandle.value.setStatus(props.status)
  overlayHandle.value.setStatusFade(props.statusFade ?? false)
  overlayHandle.value.setViewMode(document.fullscreenElement ? 'fullscreen' : 'embed')
}

watch(
  () => props.status,
  (next) => {
    overlayHandle.value?.setStatus(next)
  }
)

watch(
  () => props.statusFade,
  (next) => {
    overlayHandle.value?.setStatusFade(Boolean(next))
  }
)

watch(
  () => props.uiActions,
  () => {
    setupOverlay()
  },
  { deep: true }
)

function handleFullscreenChange() {
  overlayHandle.value?.setViewMode(document.fullscreenElement ? 'fullscreen' : 'embed')
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  overlayHandle.value?.setLoadingProgress(state)
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (file) {
    emit('loadFile', file)
  }
  if (target) {
    target.value = ''
  }
}

function hasFilePayload(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function handleDragEnter(event: DragEvent) {
  if (!hasFilePayload(event)) return
  dragDepth.value += 1
  isDragActive.value = true
}

function handleDragOver(event: DragEvent) {
  if (!hasFilePayload(event)) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(event: DragEvent) {
  if (!hasFilePayload(event)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    isDragActive.value = false
  }
}

function handleDrop(event: DragEvent) {
  if (!hasFilePayload(event)) return
  dragDepth.value = 0
  isDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    emit('loadFile', file)
  }
}

onMounted(() => {
  setupOverlay()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(() => {
  overlayHandle.value?.destroy()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

defineExpose({
  getViewerElement: () => viewerRef.value,
  setOverlayLoading,
  triggerFileSelect
})
</script>

<style scoped>

.editor-viewer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 400px;
  min-height: 400px;
  background: #060b14;
  overflow: hidden;
  border-radius: 0;
}

.editor-viewer__canvas {
  width: 100%;
  height: 100%;
}

.editor-viewer__toolbar {
  position: absolute;
  top: 10%;
  left: 1rem;
  transform: translateY(-10%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 20;
  pointer-events: none;
}

.editor-viewer__toolbar-button {
  background: rgba(6, 11, 20, 0.85);
  border: 1px solid rgba(246, 231, 195, 0.2);
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  color: inherit;
  font: inherit;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.editor-viewer__toolbar-button:hover:not(:disabled) {
  background: rgba(16, 24, 42, 0.95);
  border-color: rgba(246, 231, 195, 0.4);
}

.editor-viewer__toolbar-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-viewer__toolbar-icon {
  font-size: 0.85rem;
}

.editor-viewer__toolbar-label {
  font-size: 0.85rem;
}

.editor-viewer__drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 11, 20, 0.75);
  color: #f6e7c3;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 30;
}

.editor-viewer__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}

/* < 800px width */
@media screen and (max-width: 799px) {
  .editor-viewer__toolbar {
    flex-direction: row;
    top: auto;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
  }
  
}
</style>
