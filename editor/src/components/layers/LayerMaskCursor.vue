<template>
  <div
    v-show="visible"
    class="layer-mask-cursor"
    :class="`layer-mask-cursor--${mode}`"
    :style="style"
  >
    <span class="layer-mask-cursor__icon" :style="iconStyle">
      <Icon :icon="icon" aria-hidden="true" />
    </span>
    <span class="layer-mask-cursor__brush" :style="brushStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'

const props = withDefaults(defineProps<{
  x: number
  y: number
  visible: boolean
  brushSize: number
  zoom: number
  mode?: 'paint' | 'erase' | 'pan'
  icon?: string
  opacity?: number
}>(), {
  mode: 'paint',
  icon: 'paint-brush',
  opacity: 1
})

const diameter = computed(() => Math.max(4, props.brushSize * props.zoom))
const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}))

const brushStyle = computed(() => ({
  width: `${diameter.value}px`,
  height: `${diameter.value}px`,
  transform: `translate(-50%, -50%)`,
  opacity: Math.max(0.35, props.opacity ?? 1)
}))

const ICON_PADDING = 6
const iconStyle = computed(() => {
  const radius = diameter.value / 2
  const offset = radius + ICON_PADDING
  return {
    left: '50%',
    top: '50%',
    transform: `translate(-75%, -75%) translate(${offset}px, ${offset}px)`
  }
})
</script>

<style scoped>
.layer-mask-cursor {
  position: absolute;
  pointer-events: none;
  color: #fff;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.layer-mask-cursor__icon {
  position: absolute;
  font-size: 0.85rem;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 4px rgba(0, 0, 0, 0.75);
}

.layer-mask-cursor__brush {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.85);
}

.layer-mask-cursor--erase .layer-mask-cursor__brush {
  border-style: dashed;
}
</style>
