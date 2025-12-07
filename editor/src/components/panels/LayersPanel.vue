<template>
  <section class="panel-card">
    <header class="panel-card__header">
      <Icon icon="layer-group">Layers</Icon>
    </header>
    <div v-if="layerEntries.length" class="panel-card__list" @dragover.prevent="handleListDragOver" @drop.prevent="handleListDrop">
      <button
        v-for="entry in layerEntries"
        :key="entry.id"
        type="button"
        class="pill-button panel-card__pill"
        :class="{ 'panel-card__pill--inactive': !entry.visible }"
        :draggable="entry.kind !== 'heightmap'"
        @click="$emit('open-layer-editor', entry.id)"
        @dragstart="handleDragStart(entry)"
        @dragover.prevent="handleDragOver(entry, $event)"
        @drop.prevent="handleDrop(entry)"
        @dragend="handleDragEnd"
      >
        <Icon :icon="entry?.icon ?? 'circle'" class="panel-card__pill-icon" :style="{ color: colorToCss(entry.color) }" />
        <span class="panel-card__pill-label">{{ entry.label }}</span>
        <span class="spacer"></span>
        <div
          v-if="entry.kind !== 'heightmap'"
          title="Toggle layer visibility"
          @click="$emit('toggle-layer', entry.id)">
          <Icon :icon="entry.visible ? 'toggle-on' : 'toggle-off'" class="panel-card__pill-icon" />
        </div>
      </button>
      <div class="panel-card__pill-actions">
        <button class="pill-button panel-card__pill-small" @click="$emit('set-all', 'biome', true)">
          <Icon icon="eye">Show all biomes</Icon>
        </button>
        <button class="pill-button panel-card__pill-small" @click="$emit('set-all', 'biome', false)">
          <Icon icon="eye-slash">Hide all biomes</Icon>
        </button>
        <button class="pill-button panel-card__pill-small" @click="$emit('set-all', 'overlay', true)">
          <Icon icon="plane">Show all overlays</Icon>
        </button>
        <button class="pill-button panel-card__pill-small" @click="$emit('set-all', 'overlay', false)">
          <Icon icon="plane-slash">Hide all overlays</Icon>
        </button>
      </div>
      <div class="panel-card__pill-actions">
        <button class="pill-button panel-card__pill-small" type="button" @click="$emit('add-layer')">
          <Icon icon="plus">Add layer</Icon>
        </button>
      </div>
      <div
        v-if="draggingId"
        class="panel-card__dropzone"
      >
        Drop here to move layer to the bottom.
      </div>
    </div>
    <p v-else class="panel-card__placeholder">No biome or overlay layers defined yet.</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { LayerEntry } from '../../composables/useLayersModel'
import Icon from '../Icon.vue'

defineProps<{
  layerEntries: LayerEntry[]
  colorToCss: (color: [number, number, number]) => string
}>()

const emit = defineEmits<{
  'toggle-layer': [id: string]
  'open-layer-editor': [id: string]
  'set-all': [kind: 'biome' | 'overlay', visible: boolean]
  'add-layer': []
  'reorder-layer': [{ sourceId: string; targetId: string | null }]
}>()

const draggingId = ref<string | null>(null)
const draggingKind = ref<'biome' | 'overlay' | null>(null)

function handleDragStart(entry: LayerEntry) {
  if (entry.kind === 'heightmap') return
  draggingId.value = entry.id
  draggingKind.value = entry.kind
}

function handleDragOver(entry: LayerEntry, event: DragEvent) {
  if (!draggingId.value || !draggingKind.value) return
  if (entry.kind !== draggingKind.value || entry.id === draggingId.value) return
  event.preventDefault()
}

function handleDrop(entry: LayerEntry) {
  if (!draggingId.value || !draggingKind.value) return
  if (entry.kind !== draggingKind.value || entry.id === draggingId.value) return
  emit('reorder-layer', { sourceId: draggingId.value, targetId: entry.id })
  draggingId.value = null
  draggingKind.value = null
}

function handleDragEnd() {
  draggingId.value = null
  draggingKind.value = null
}

function handleListDragOver(event: DragEvent) {
  if (!draggingId.value) return
  event.preventDefault()
}

function handleListDrop() {
  if (!draggingId.value) return
  emit('reorder-layer', { sourceId: draggingId.value, targetId: null })
  draggingId.value = null
  draggingKind.value = null
}
</script>

<style scoped>
.panel-card__dropzone {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.75rem;
  text-align: center;
  opacity: 0.75;
}
</style>
