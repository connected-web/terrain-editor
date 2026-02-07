<template>
  <div class="layer-create-dialog">
    <section class="layer-create-dialog__panel">
      <header class="layer-create-dialog__header">
        <h2>Create Layer</h2>
        <button type="button" class="pill-button pill-button--ghost" @click="$emit('cancel')">
          <Icon icon="xmark" />
        </button>
      </header>
      <form class="layer-create-dialog__form" @submit.prevent="handleSubmit">
        <label>
          <span>Layer name</span>
          <input type="text" v-model="form.label" required />
        </label>
        <label>
          <span>Layer type</span>
          <select v-model="form.kind">
            <option value="biome">Biome</option>
            <option value="overlay">Overlay</option>
          </select>
        </label>
        <label v-if="form.kind === 'overlay'">
          <span>Overlay mode</span>
          <select v-model="form.overlayMode">
            <option value="mask">Mask (grayscale)</option>
            <option value="rgba">Texture (RGBA)</option>
          </select>
        </label>
        <label>
          <span>Layer colour</span>
          <input type="color" v-model="form.color" :disabled="form.kind === 'overlay' && form.overlayMode === 'rgba'" />
        </label>
        <footer class="layer-create-dialog__actions">
          <button type="button" class="pill-button pill-button--ghost" @click="$emit('cancel')">
            Cancel
          </button>
          <button type="submit" class="pill-button">
            <Icon icon="plus">Create</Icon>
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import Icon from './Icon.vue'

const emit = defineEmits<{
  create: [{
    label: string
    kind: 'biome' | 'overlay'
    color: [number, number, number]
    overlayMode: 'mask' | 'rgba'
  }]
  cancel: []
}>()

const form = reactive({
  label: 'New Layer',
  kind: 'biome' as 'biome' | 'overlay',
  color: '#ffffff',
  overlayMode: 'mask' as 'mask' | 'rgba'
})

function handleSubmit() {
  const rgb: [number, number, number] = [
    parseInt(form.color.slice(1, 3), 16),
    parseInt(form.color.slice(3, 5), 16),
    parseInt(form.color.slice(5, 7), 16)
  ]
  emit('create', {
    label: form.label.trim() || 'New Layer',
    kind: form.kind,
    color: rgb,
    overlayMode: form.overlayMode
  })
}
</script>

<style scoped>
.layer-create-dialog {
  position: fixed;
  inset: 0;
  background: rgba(6, 11, 20, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}

.layer-create-dialog__panel {
  width: min(360px, 90vw);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.layer-create-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.layer-create-dialog__header h2 {
  margin: 0;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.layer-create-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.layer-create-dialog__form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
}

.layer-create-dialog__form input,
.layer-create-dialog__form select {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 0.45rem 0.65rem;
  color: inherit;
}

.layer-create-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
