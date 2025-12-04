<template>
  <div
    v-show="visible"
    class="layer-mask-cursor"
    :class="`layer-mask-cursor--${mode}`"
    :style="style"
  >
    <Icon :icon="icon" aria-hidden="true" />
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
}>(), {
  mode: 'paint',
  icon: 'paint-brush'
})

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}))

const brushStyle = computed(() => {
  const diameter = Math.max(4, props.brushSize * props.zoom)
  return {
    width: `${diameter}px`,
    height: `${diameter}px`
  }
})
</script>

<style scoped>
.layer-mask-cursor {
  position: absolute;
  pointer-events: none;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.layer-mask-cursor__brush {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.9);
}

.layer-mask-cursor--erase .layer-mask-cursor__brush {
  border-style: dashed;
}
</style>
