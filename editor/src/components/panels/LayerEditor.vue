<template>
  <div class="layer-editor">
    <section class="layer-editor__panel">
      <header class="layer-editor__header">
        <h2><Icon icon="layer-group">Layer Editor</Icon></h2>
        <button type="button" class="pill-button pill-button--ghost" @click="$emit('close')">
          <Icon icon="xmark" />
        </button>
      </header>
      <h4>{{ activeLayer?.label ?? 'No layer selected' }}</h4>
      <pre><code>{{ activeLayer }}</code></pre>
      <div class="layer-editor__image">
        <label>TODO: Display layer image here</label>
      </div>
      <footer class="layer-editor__footer">
        <button class="pill-button" @click="$emit('export-layer')">
          <Icon icon="file-export">Export layer</Icon>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { TerrainProjectFileEntry } from '@connected-web/terrain-editor'
import { LayerEntry } from '../../composables/useLayersModel'

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  getPreview: (path: string) => string
  filterText?: string
  activeLayer: LayerEntry | null
}>()

const emit = defineEmits<{
  (ev: 'select', path: string): void
  (ev: 'remove', path: string): void
  (ev: 'export-layer'): void
  (ev: 'close'): void
  (ev: 'replace', asset: TerrainProjectFileEntry): void
}>()
</script>

<style scoped>
.layer-editor {
  position: fixed;
  z-index: 200;
  top: 0;
  bottom: 0;
  right: 0;
  width: 50vw;
}

.layer-editor__panel {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  bottom: 1.5rem;
  width: min(500px, 90vw);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 18px;
  padding: 0.75rem 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.layer-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.layer-editor__header h2 {
  margin: 0;
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(242, 237, 224, 0.7);
}

.layer-editor__image {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;
  padding-top: 0.25rem;
}

.layer-editor__image::-webkit-scrollbar {
  width: 8px;
}

.layer-editor__image::-webkit-scrollbar-thumb {
  background: rgba(246, 231, 195, 0.35);
}

.layer-editor__actions {
  grid-column: span 2;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.layer-editor__footer {
  display: flex;
  justify-content: flex-end;
}

@media  (max-width: 1024px) {
  .layer-editor__panel {
    top: 1rem;
    right: 1rem;
    bottom: 1rem;
    width: calc(100vw - 2rem);
  }
}
</style>
