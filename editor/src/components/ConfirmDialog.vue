<template>
  <div class="confirm-dialog">
    <div class="confirm-dialog__backdrop" @click="$emit('cancel')" />
    <section class="confirm-dialog__panel">
      <p>{{ message }}</p>
      <div class="confirm-dialog__actions">
        <button type="button" class="pill-button pill-button--ghost" @click="$emit('cancel')">{{ cancelLabel }}</button>
        <button
          v-if="secondaryLabel"
          type="button"
          class="pill-button pill-button--ghost"
          @click="$emit('secondary')"
        >
          {{ secondaryLabel }}
        </button>
        <button type="button" :class="confirmButtonClass" @click="$emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{
  message: string
  confirmLabel?: string
  cancelLabel?: string
  secondaryLabel?: string
  confirmVariant?: 'primary' | 'danger'
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  secondaryLabel: undefined,
  confirmVariant: 'danger'
})

defineEmits<{ confirm: []; cancel: []; secondary: [] }>()

const confirmButtonClass = computed(() => {
  return props.confirmVariant === 'danger'
    ? 'pill-button pill-button--danger'
    : 'pill-button'
})

const cancelLabel = props.cancelLabel
const secondaryLabel = props.secondaryLabel
const confirmLabel = props.confirmLabel
const message = props.message
</script>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 300;
}

.confirm-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.confirm-dialog__panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(320px, 90vw);
  background: rgba(5, 8, 17, 0.95);
  border-radius: 16px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
