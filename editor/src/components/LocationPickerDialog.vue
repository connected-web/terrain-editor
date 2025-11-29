<template>
  <div class="location-dialog">
    <div class="location-dialog__backdrop" @click="$emit('close')" />
    <section class="location-dialog__panel">
      <header class="location-dialog__header">
        <h2>Select a location</h2>
        <button type="button" class="pill-button pill-button--ghost" @click="$emit('close')">
          <Icon icon="xmark" />
        </button>
      </header>
      <div class="location-dialog__search">
        <Icon icon="magnifying-glass" />
        <input
          type="search"
          v-model="query"
          placeholder="Search by name or id"
        />
      </div>
      <div class="location-dialog__list">
        <button
          v-for="location in filtered"
          :key="location.id"
          type="button"
          class="location-dialog__item"
          :class="{ 'location-dialog__item--active': location.id === activeId }"
          @click="$emit('select', location.id!)"
        >
          <div class="row left">
            <strong>{{ location.name || location.id }}</strong>
          </div>
          <span class="location-dialog__coords">
            <Icon icon="location-dot" :rtl="true">{{ location.pixel.x }}, {{ location.pixel.y }}</Icon>
          </span>
        </button>
        <p v-if="!filtered.length" class="location-dialog__empty">No locations match this search.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TerrainLocation } from '@connected-web/terrain-editor'

const props = defineProps<{
  locations: TerrainLocation[]
  activeId?: string
}>()

defineEmits<{
  select: [string]
  close: []
}>()

const query = ref('')

const filtered = computed(() => {
  const value = query.value.trim().toLowerCase()
  if (!value) return props.locations
  return props.locations.filter((location) => {
    const label = (location.name || location.id || '').toLowerCase()
    const id = (location.id ?? '').toLowerCase()
    return label.includes(value) || id.includes(value)
  })
})
</script>

<style scoped>
.location-dialog {
  position: fixed;
  inset: 0;
  z-index: 210;
}

.location-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.location-dialog__panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, 90vw);
  max-height: min(600px, 90vh);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 18px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.location-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.location-dialog__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.location-dialog__search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
}

.location-dialog__search input {
  flex: 1;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 0.9rem;
}

.location-dialog__search input:focus {
  outline: none;
}

.location-dialog__list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-right: 0.2rem;
}

.location-dialog__list::-webkit-scrollbar {
  width: 8px;
}

.location-dialog__list::-webkit-scrollbar-thumb {
  background: rgba(246, 231, 195, 0.35);
  border-radius: 999px;
}

.location-dialog__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.location-dialog__item:hover {
  border-color: rgba(246, 231, 195, 0.4);
  background: rgba(246, 231, 195, 0.05);
}

.location-dialog__item:active {
  outline: none;
  border-color: rgba(246, 231, 195, 0.5);
  background: rgba(2, 2, 1, 0.06);
}

.location-dialog__item--active {
  border-color: rgba(77, 70, 56, 0.6);
  background: rgba(246, 231, 195, 0.08);
}

.location-dialog__item strong {
  display: block;
  font-size: 0.95rem;
}

.location-dialog__item small {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
}

.location-dialog__coords {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.location-dialog__empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}
</style>
