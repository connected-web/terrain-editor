<template>
  <section class="panel-card panel-card--assets">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <h2><Icon icon="image">Asset library</Icon></h2>
        <span v-if="modeLabel" class="panel-card__hint">{{ modeLabel }}</span>
      </div>
      <button type="button" class="pill-button pill-button--ghost" @click="$emit('close')">
        <Icon icon="xmark" />
      </button>
    </header>
    <label class="asset-panel__search">
      <Icon icon="magnifying-glass" />
      <input
        type="search"
        placeholder="Search assets"
        v-model="filterModel"
        spellcheck="false"
      />
    </label>
    <div class="asset-panel__grid">
      <article v-for="asset in filteredAssets" :key="asset.path" class="asset-panel__item">
        <div
          class="asset-panel__thumb button"
          :style="{ backgroundImage: getPreview(asset.path) ? `url('${getPreview(asset.path)}')` : undefined }"
          @click="$emit('select', asset.path)"
        />
        <div class="asset-panel__meta">
          <strong>{{ asset.sourceFileName ?? asset.path }}</strong>
          <span>{{ asset.type ?? 'binary' }}</span>
        </div>
        <div class="asset-panel__actions">
          <button class="pill-button pill-button--ghost" @click="$emit('select', asset.path)">
            <Icon icon="check">Use asset</Icon>
          </button>
          <button class="pill-button pill-button--ghost" @click="$emit('replace', asset)">
            <Icon icon="upload">Replace asset</Icon>
          </button>
          <button class="pill-button pill-button--danger" @click="$emit('remove', asset.path)">
            <Icon icon="trash">Remove</Icon>
          </button>
        </div>
      </article>
    </div>
    <footer class="asset-panel__footer">
      <button class="pill-button" @click="$emit('upload')">
        <Icon icon="upload">Upload asset</Icon>
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TerrainProjectFileEntry } from '@connected-web/terrain-editor'

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  getPreview: (path: string) => string
  filterText?: string
  mode?: 'default' | 'icon' | 'layer'
}>()

const emit = defineEmits<{
  (ev: 'select', path: string): void
  (ev: 'remove', path: string): void
  (ev: 'upload'): void
  (ev: 'close'): void
  (ev: 'replace', asset: TerrainProjectFileEntry): void
  (ev: 'update:filterText', value: string): void
}>()

const filterModel = computed({
  get: () => props.filterText ?? '',
  set: (value: string) => {
    emit('update:filterText', value)
  }
})

const modeLabel = computed(() => {
  if (props.mode === 'icon') return 'Showing icon assets'
  if (props.mode === 'layer') return 'Showing layer textures'
  return ''
})

const filteredAssets = computed(() => {
  const list = props.assets ?? []
  const query = filterModel.value.trim().toLowerCase()
  if (!query) return list
  return list.filter((asset) => {
    const haystack = `${asset.sourceFileName ?? asset.path} ${asset.type ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })
})
</script>

<style scoped>
.asset-panel__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(8, 13, 22, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-size: 0.9rem;
}

.asset-panel__search input {
  background: transparent;
  border: none;
  color: inherit;
  width: 100%;
  outline: none;
}

.asset-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  max-height: 58vh;
  overflow: auto;
  padding-right: 0.25rem;
}

.asset-panel__item {
  background: rgba(8, 12, 22, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 0.65rem;
  display: grid;
  gap: 0.5rem;
}

.asset-panel__thumb {
  height: 110px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: rgba(0, 0, 0, 0.3);
  background-size: cover;
  background-position: center;
}

.asset-panel__meta {
  display: grid;
  gap: 0.2rem;
  font-size: 0.85rem;
}

.asset-panel__actions {
  display: grid;
  gap: 0.35rem;
}

.asset-panel__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
