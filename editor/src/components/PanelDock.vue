<template>
  <aside
    ref="rootRef"
    class="panel-dock"
    :class="{
      'panel-dock--collapsed': collapsed,
      'panel-dock--mobile': mobile
    }"
  >
    <button type="button" class="panel-dock__toggle" @click="$emit('toggle')">
      <Icon :icon="toggleIcon" :key="toggleIcon" />
    </button>
    <div class="panel-dock__inner">
      <div class="panel-dock__nav">
        <slot name="nav" />
      </div>
      <div class="panel-dock__content">
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  collapsed: boolean
  mobile: boolean
}>()

defineEmits<{
  toggle: []
}>()

const rootRef = ref<HTMLElement | null>(null)

const toggleIcon = computed(() => {
  if (props.collapsed) {
    return props.mobile ? 'angles-up' : 'angles-right'
  }
  return props.mobile ? 'angles-down' : 'angles-left'
})

defineExpose({
  element: rootRef
})
</script>

<style scoped>
.panel-dock {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(50%, 420px);
  min-width: 260px;
  max-width: 50%;
  transition: width 0.2s ease;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(6, 11, 20, 0.92);
  backdrop-filter: blur(8px);
  height: 100%;
  margin-left: 1.5rem;
}

.panel-dock--mobile {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border-left: none;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-dock--collapsed {
  width: 24px;
  min-width: 24px;
  max-width: 24px;
}

.panel-dock--mobile.panel-dock--collapsed {
  height: 20px;
  width: 100%;
}

.panel-dock__toggle {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(7, 11, 18, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  color: inherit;
  cursor: pointer;
  z-index: 2;
}

.panel-dock__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 10px;
}

.panel-dock__nav {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem 1rem 0;
}

.panel-dock__content {
  flex: 1;
  padding: 0 1rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  max-height: 95vh;
}

.panel-dock__content::-webkit-scrollbar {
  width: 8px;
}

.panel-dock__content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
}

.panel-dock__content::-webkit-scrollbar-thumb {
  background: rgba(246, 231, 195, 0.35);
  border-radius: 999px;
}

.panel-dock--collapsed .panel-dock__content {
  display: none;
}

.panel-dock--collapsed .panel-dock__nav {
  display: none;
}
</style>
