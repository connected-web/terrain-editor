<template>
  <aside
    ref="rootRef"
    class="panel-dock"
    :class="panelDockClasses"
  >
    <button type="button" class="panel-dock__toggle" @click="$emit('toggle')">
      <Icon :icon="toggleIcon" :key="toggleIcon" />
    </button>
    <div class="panel-dock__inner">
      <div class="panel-dock__nav" :class="{ 'panel-dock__nav--hidden': !hasNavContent }">
        <slot name="nav" />
      </div>
      <div class="panel-dock__content">
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'

const props = defineProps<{
  collapsed: boolean
  mobile: boolean
  expanded?: boolean
  hideNav?: boolean
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

const slots = useSlots()
const panelDockClasses = computed(() => ({
  'panel-dock--collapsed': props.collapsed,
  'panel-dock--mobile': props.mobile,
  'panel-dock--expanded': props.expanded
}))
const hasNavContent = computed(() => !props.hideNav && Boolean(slots.nav?.().length))

defineExpose({
  element: rootRef
})
</script>

<style scoped>
.panel-dock {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(45%, 420px);
  min-width: 300px;
  max-width: 50%;
  transition: width 0.2s ease;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  height: 100vh;
  margin-left: 5rem;
  overflow: hidden;
}

.panel-dock--expanded {
  width: 100%;
  max-width: 100%;
  margin-left: 0;
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
  transition: background 0.2s ease, border-color 0.2s ease;
}

.panel-dock__toggle:hover {
  background: rgba(7, 11, 18, 1);
  border-color: rgba(196, 174, 53, 0.692);
}

.panel-dock__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
}

.panel-dock--expanded .panel-dock__inner {
  flex-direction: row;
}

.panel-dock__nav {
  flex: 0 0 auto;
  width: 100%;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-dock--expanded .panel-dock__nav {
  width: 280px;
  overflow-y: auto;
  border-bottom: none;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-dock__nav--hidden {
  display: none;
}

.panel-dock__nav-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.panel-dock__nav-divider {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0.35rem 0;
}

.panel-dock__nav-button--muted {
  opacity: 0.8;
}

.panel-dock__content {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  max-height: 100%;
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

.panel-dock--collapsed .panel-dock__content,
.panel-dock--collapsed .panel-dock__nav {
  display: none;
}

.panel-dock--mobile .panel-dock__inner {
  flex-direction: column;
}

.panel-dock--mobile .panel-dock__nav {
  width: 100%;
  border-right: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
