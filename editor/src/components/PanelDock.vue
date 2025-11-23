<template>
  <aside
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
import { computed } from 'vue'

const props = defineProps<{
  collapsed: boolean
  mobile: boolean
}>()

defineEmits<{
  toggle: []
}>()

const toggleIcon = computed(() => {
  if (props.collapsed) {
    return props.mobile ? 'angles-up' : 'angles-right'
  }
  return props.mobile ? 'angles-down' : 'angles-left'
})
</script>

<style scoped>
.panel-dock {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(50%, 420px);
  min-width: 280px;
  max-width: 50%;
  transition: width 0.2s ease;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(6, 11, 20, 0.85);
  backdrop-filter: blur(6px);
}

.panel-dock--mobile {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border-left: none;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-dock--collapsed {
  width: 20px;
  min-width: 20px;
  max-width: 20px;
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
}

.panel-dock--collapsed .panel-dock__content {
  display: none;
}

.panel-dock--collapsed .panel-dock__nav {
  display: none;
}
</style>
