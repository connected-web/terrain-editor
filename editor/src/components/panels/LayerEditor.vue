<template>
  <div class="layer-editor">
    <section class="layer-editor__panel">
      <header class="layer-editor__header">
        <div>
          <p class="layer-editor__eyebrow">Layer editor</p>
          <h2>{{ activeLayer?.label ?? 'Select a layer' }}</h2>
        </div>
        <div class="layer-editor__header-actions">
          <button
            v-if="activeLayer"
            type="button"
            class="pill-button pill-button--ghost"
            @click="$emit('export-layer')"
          >
            <Icon icon="file-export">Export layer</Icon>
          </button>
          <button type="button" class="pill-button pill-button--ghost" @click="$emit('close')">
            <Icon icon="xmark" />
          </button>
        </div>
      </header>

      <div v-if="activeLayer" class="layer-editor__body">
        <aside class="layer-editor__meta">
          <label class="layer-editor__field">
            <span>Biome colour</span>
            <input
              :value="activeColourHex"
              type="color"
              aria-label="Biome colour"
              @change="handleColourChange"
            >
          </label>
        </aside>

        <div class="layer-editor__workspace">
          <LayerMaskEditor
            v-if="maskUrl"
            :src="maskUrl"
            @update-mask="handleUpdateMask"
          />
          <p v-else class="layer-editor__placeholder">
            No mask image found for this layer.
          </p>
        </div>
      </div>

      <div v-else class="layer-editor__empty">
        <p>Select a layer from the sidebar to edit its mask and colour.</p>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import type { LayerEntry } from '../../composables/useLayersModel'
import LayerMaskEditor from '../layers/LayerMaskEditor.vue'

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  filterText?: string
  activeLayer: LayerEntry | null
}>()

const emit = defineEmits<{
  (ev: 'select', path: string): void
  (ev: 'remove', path: string): void
  (ev: 'export-layer'): void
  (ev: 'close'): void
  (ev: 'replace', asset: TerrainProjectFileEntry): void
  (ev: 'update-colour', payload: { id: string; color: [number, number, number] }): void
}>()

const activeMaskAsset = computed(() => {
  if (!props.activeLayer?.mask) return null
  return props.assets.find(entry => entry.path === props.activeLayer?.mask) ?? null
})

const maskObjectUrl = ref<string | null>(null)

watch(
  () => activeMaskAsset.value,
  (asset) => {
    if (maskObjectUrl.value) {
      URL.revokeObjectURL(maskObjectUrl.value)
      maskObjectUrl.value = null
    }
    if (!asset || !asset.data) return
    const blob = new Blob([asset.data], { type: asset.type ?? 'image/png' })
    maskObjectUrl.value = URL.createObjectURL(blob)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (maskObjectUrl.value) {
    URL.revokeObjectURL(maskObjectUrl.value)
  }
})

const maskUrl = computed(() => maskObjectUrl.value)

const activeColourHex = computed(() => {
  const colour = props.activeLayer?.color
  if (!colour) return '#ffffff'
  const [r, g, b] = colour
  return (
    '#' +
    [r, g, b]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
  )
})

async function handleUpdateMask (blob: Blob) {
  if (!activeMaskAsset.value) return

  const data = await blob.arrayBuffer()
  emit('replace', {
    ...activeMaskAsset.value,
    data,
    lastModified: Date.now()
  })
}

function handleColourChange (event: Event) {
  const input = event.target as HTMLInputElement | null
  if (!input || !props.activeLayer) return
  const value = input.value
  const r = parseInt(value.slice(1, 3), 16)
  const g = parseInt(value.slice(3, 5), 16)
  const b = parseInt(value.slice(5, 7), 16)
  emit('update-colour', {
    id: props.activeLayer.id,
    color: [r, g, b]
  })
}
</script>

<style scoped>
.layer-editor {
  position: fixed;
  z-index: 200;
  top: 0;
  bottom: 0;
  right: 0;
  left: auto;
  pointer-events: none;
}

.layer-editor__panel {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  bottom: 1.5rem;
  width: min(620px, 95vw);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 18px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  margin-left: auto;
}

.layer-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.layer-editor__header h2 {
  margin: 0;
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(242, 237, 224, 0.7);
}

.layer-editor__eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.layer-editor__header-actions {
  display: flex;
  gap: 0.5rem;
}

.layer-editor__body {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

@media (max-width: 760px) {
  .layer-editor__body {
    grid-template-columns: 1fr;
  }
}

.layer-editor__meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.layer-editor__workspace {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.75rem;
  background: rgba(5, 8, 17, 0.65);
  min-height: 0;
  display: flex;
}

.layer-editor__workspace > * {
  flex: 1;
  min-height: 0;
}

@media  (max-width: 1024px) {
  .layer-editor__panel {
    top: 1rem;
    right: 1rem;
    bottom: 1rem;
    width: calc(100vw - 2rem);
  }
}

.layer-editor__field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.layer-editor__field span {
  opacity: 0.8;
}

.layer-editor__field input[type='color'] {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  cursor: pointer;
}

.layer-editor__placeholder {
  margin: 0;
  opacity: 0.7;
  font-size: 0.85rem;
}

.layer-editor__workspace .layer-editor__placeholder {
  text-align: center;
  width: 100%;
}

.layer-editor__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  padding: 2rem;
}

</style>
