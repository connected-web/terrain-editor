<template>
  <section class="panel-card">
    <header class="panel-card__header">
      <Icon icon="layer-group">Layers</Icon>
    </header>
    <div v-if="layerEntries.length" class="panel-card__list">
      <button
        v-for="entry in layerEntries"
        :key="entry.id"
        type="button"
        class="pill-button panel-card__pill"
        :class="{ 'panel-card__pill--inactive': !entry.visible }"
        @click="$emit('toggle-layer', entry.id)"
      >
        <span class="panel-card__pill-swatch" :style="{ backgroundColor: colorToCss(entry.color) }" />
        <span class="panel-card__pill-label">{{ entry.label }}</span>
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
    </div>
    <p v-else class="panel-card__placeholder">Legend data not loaded yet.</p>
  </section>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue'

type LayerEntry = {
  id: string
  label: string
  visible: boolean
  color: [number, number, number]
}

defineProps<{
  layerEntries: LayerEntry[]
  colorToCss: (color: [number, number, number]) => string
}>()

defineEmits<{
  'toggle-layer': [id: string]
  'set-all': [kind: 'biome' | 'overlay', visible: boolean]
}>()
</script>
