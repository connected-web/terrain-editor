<template>
  <section class="panel-card">
    <header class="panel-card__header">
      <Icon icon="layer-group">Layers</Icon>
    </header>
    <div v-if="hasLayerSections" class="layers-panel__content">
      <LayerList
        :sections="sections"
        :color-to-css="props.colorToCss"
        :section-hints="sectionHints"
        @open-layer="$emit('open-layer-editor', $event)"
        @toggle-layer="$emit('toggle-layer', $event)"
        @toggle-onion="$emit('toggle-onion', $event)"
        @reorder-layer="$emit('reorder-layer', $event)"
      />
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
    </div>
    <p v-else class="panel-card__placeholder">No biome or overlay layers defined yet.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LayerEntry } from '../../composables/useLayersModel'
import Icon from '../Icon.vue'
import LayerList from '../layers/LayerList.vue'
import { buildLayerSections, type LayerSectionKey } from '../../utils/layerSections'

const props = defineProps<{
  layerEntries: LayerEntry[]
  colorToCss: (color: [number, number, number]) => string
}>()

const emit = defineEmits<{
  'toggle-layer': [id: string]
  'open-layer-editor': [id: string]
  'set-all': [kind: 'biome' | 'overlay', visible: boolean]
  'add-layer': []
  'reorder-layer': [{ sourceId: string; targetId: string | null }]
  'toggle-onion': [id: string]
}>()

const sections = computed(() => buildLayerSections(props.layerEntries))
const hasLayerSections = computed(() => sections.value.some((section) => section.entries.length > 0))
const sectionHints: Partial<Record<LayerSectionKey, string>> = {
  heightmap: 'Locked base terrain',
  biome: 'Lower entries render first',
  overlay: 'Later overlays appear above'
}
</script>

<style scoped>
.layers-panel__content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
