<template>
  <div class="editor-viewer" ref="rootRef">
    <div ref="viewerRef" class="editor-viewer__canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createViewerOverlay,
  type ViewerOverlayHandle,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'

const props = defineProps<{
  status: string
  interactive: boolean
}>()

const emit = defineEmits<{
  loadFile: [File]
  toggleInteraction: []
  toggleFullscreen: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const viewerRef = ref<HTMLElement | null>(null)
const overlayHandle = ref<ViewerOverlayHandle | null>(null)

function buildOptions() {
  return {
    selectFile: {
      callback: (file: File) => emit('loadFile', file)
    },
    popout: {
      enabled: false
    },
    fullscreen: {
      enabled: true,
      displayInEmbed: true,
      onToggle: () => emit('toggleFullscreen')
    },
    customButtons: [
      {
        location: 'bottom-right',
        label: props.interactive ? 'Disable placement' : 'Enable placement',
        callback: () => emit('toggleInteraction')
      }
    ]
  }
}

function setupOverlay() {
  if (!viewerRef.value) return
  overlayHandle.value?.destroy()
  overlayHandle.value = createViewerOverlay(viewerRef.value, buildOptions())
  overlayHandle.value.setStatus(props.status)
  overlayHandle.value.setViewMode(document.fullscreenElement ? 'fullscreen' : 'embed')
}

watch(
  () => props.status,
  (next) => {
    overlayHandle.value?.setStatus(next)
  }
)

watch(
  () => props.interactive,
  () => {
    setupOverlay()
  }
)

function handleFullscreenChange() {
  overlayHandle.value?.setViewMode(document.fullscreenElement ? 'fullscreen' : 'embed')
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  overlayHandle.value?.setLoadingProgress(state)
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
  setOverlayLoading
})
</script>

<style scoped>
.editor-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: #060b14;
  border-radius: 20px;
  overflow: hidden;
}

.editor-viewer__canvas {
  width: 100%;
  height: 100%;
}
</style>
