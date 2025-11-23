<template>
  <div class="asset-dialog">
    <div class="asset-dialog__backdrop" @click="$emit('close')" />
    <section class="asset-dialog__panel">
      <header class="asset-dialog__header">
        <h2>Asset library</h2>
        <button type="button" class="pill-button pill-button--ghost" @click="$emit('close')">
          <Icon icon="xmark" />
        </button>
      </header>
      <div class="asset-dialog__grid">
        <article v-for="asset in filteredAssets" :key="asset.path" class="asset-dialog__item">
          <div
            class="asset-dialog__thumb"
            :style="{ backgroundImage: getPreview(asset.path) ? `url('${getPreview(asset.path)}')` : undefined }"
          />
          <div class="asset-dialog__meta">
            <strong>{{ asset.sourceFileName ?? asset.path }}</strong>
            <span>{{ asset.type ?? 'binary' }}</span>
          </div>
          <div class="asset-dialog__actions">
            <button class="pill-button pill-button--ghost" @click="$emit('select', asset.path)">
              Use asset
            </button>
            <button class="pill-button pill-button--danger" @click="$emit('remove', asset.path)">
              Remove
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
}>()

const filteredAssets = computed(() => props.assets ?? [])
</script>

<style scoped>
.asset-dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
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
  width: min(420px, 90vw);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 18px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.asset-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.asset-dialog__grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.3rem;
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
  margin-right: 0.2rem;
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
