<template>
  <div class="asset-dialog" :class="{ 'asset-dialog--embedded': embedded }">
    <div v-if="!embedded" class="asset-dialog__backdrop" @click="$emit('close')" />
    <section class="asset-dialog__panel">
      <header class="asset-dialog__header">
        <h2><Icon icon="image">Asset library</Icon></h2>
        <button
          v-if="showClose"
          type="button"
          class="pill-button pill-button--ghost"
          @click="$emit('close')"
        >
          <Icon :icon="closeIcon">{{ closeLabel }}</Icon>
        </button>
      </header>
      <label class="asset-dialog__search">
        <Icon icon="magnifying-glass" />
        <input
          type="search"
          placeholder="Search assets"
          v-model="filterModel"
          spellcheck="false"
        />
      </label>
      <div class="asset-dialog__grid">
        <article v-for="asset in filteredAssets" :key="asset.path" class="asset-dialog__item">
          <div
            class="asset-dialog__thumb"
            :class="{ button: showSelect }"
            :style="{ backgroundImage: getPreview(asset.path) ? `url('${getPreview(asset.path)}')` : undefined }"
            @click="handleSelect(asset.path)"
          />
          <div class="asset-dialog__meta">
            <strong>{{ asset.sourceFileName ?? asset.path }}</strong>
            <span>{{ asset.type ?? 'binary' }}</span>
          </div>
          <div class="asset-dialog__actions">
            <button
              v-if="showSelect"
              class="pill-button pill-button--ghost"
              @click="$emit('select', asset.path)"
            >
              <Icon icon="check">{{ selectLabel }}</Icon>
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
      <footer class="asset-dialog__footer">
        <button class="pill-button" @click="$emit('upload')">
          <Icon icon="upload">Upload asset</Icon>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TerrainProjectFileEntry } from '@connected-web/terrain-editor'

const props = defineProps<{
  assets: TerrainProjectFileEntry[]
  getPreview: (path: string) => string
  filterText?: string
  embedded?: boolean
  showSelect?: boolean
  selectLabel?: string
  showClose?: boolean
  closeLabel?: string
  closeIcon?: string
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
  set: (value: string) => emit('update:filterText', value)
})

const embedded = computed(() => Boolean(props.embedded))
const showSelect = computed(() => props.showSelect !== false)
const selectLabel = computed(() => props.selectLabel ?? 'Use asset')
const showClose = computed(() => props.showClose !== false)
const closeLabel = computed(() => props.closeLabel ?? 'Close')
const closeIcon = computed(() => props.closeIcon ?? 'xmark')

function handleSelect(path: string) {
  if (!showSelect.value) return
  emit('select', path)
}

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
.asset-dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
}

.asset-dialog--embedded {
  position: relative;
  inset: auto;
  z-index: auto;
  height: 100%;
}

.asset-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.asset-dialog__panel {
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

.asset-dialog--embedded .asset-dialog__panel {
  position: static;
  width: 100%;
  height: 100%;
  max-height: 100%;
  border-radius: 16px;
}

.asset-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.asset-dialog__header h2 {
  margin: 0;
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(242, 237, 224, 0.7);
}

.asset-dialog__search {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

.asset-dialog__search input {
  flex: 1;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  min-width: 0;
}

.asset-dialog__search input:focus {
  outline: none;
}

.asset-dialog__grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;
  padding-top: 0.25rem;
}

.asset-dialog__grid::-webkit-scrollbar {
  width: 8px;
}

.asset-dialog__grid::-webkit-scrollbar-thumb {
  background: rgba(246, 231, 195, 0.35);
}

.asset-dialog__item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0.6rem;
  background: rgba(0, 0, 0, 0.25);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  margin-right: 0.4rem;
}

.asset-dialog__thumb {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  background-size: cover;
  background-position: center;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.asset-dialog__thumb.button {
  cursor: pointer;
  border-color: rgba(255, 255, 255, 0.2);
  transition: border-color 0.2s ease;
}

.asset-dialog__thumb.button:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.asset-dialog__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
}

.asset-dialog__actions {
  grid-column: span 2;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.asset-dialog__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
