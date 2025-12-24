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
    <span v-if="showBrushRing" class="layer-mask-cursor__brush" :style="brushStyle" />
    <span v-if="showSwatch" class="layer-mask-cursor__swatch" :style="swatchStyle">
      <span class="layer-mask-cursor__swatch-label">{{ swatchLabel }}</span>
    </span>
    <span v-if="showTargetDot" class="layer-mask-cursor__target-dot"></span>
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
  showBrushRing?: boolean
  anchor?: 'center' | 'bottom-left'
  sampleValue?: number | null
  showTargetDot?: boolean
}>(), {
  mode: 'paint',
  icon: 'paint-brush',
  opacity: 1,
  showBrushRing: true,
  anchor: 'center',
  sampleValue: null,
  showTargetDot: false
})

const diameter = computed(() => Math.max(4, props.brushSize * props.zoom))
const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  transform: props.anchor === 'bottom-left' ? 'translate(0, 0)' : 'translate(-50%, -50%)'
}))

const brushStyle = computed(() => ({
  width: `${diameter.value}px`,
  height: `${diameter.value}px`,
  transform: `translate(-50%, -50%)`,
  opacity: Math.max(0.35, props.opacity ?? 1)
}))

const ICON_PADDING = 6
const iconStyle = computed(() => {
  if (props.anchor === 'bottom-left') {
    return {
      left: '0',
      top: '0',
      transform: 'translate(0.2rem, -0.2rem)'
    }
  }
  const radius = diameter.value / 2
  const offset = radius + ICON_PADDING
  return {
    left: '50%',
    top: '50%',
    transform: `translate(-75%, -75%) translate(${offset}px, ${offset}px)`
  }
})

const showSwatch = computed(() => props.sampleValue !== null && props.sampleValue !== undefined)
const swatchLabel = computed(() =>
  props.sampleValue === null || props.sampleValue === undefined
    ? ''
    : `${Math.round(props.sampleValue * 100)}%`
)
const swatchStyle = computed(() => {
  const value = props.sampleValue ?? 0
  const channel = Math.round(value * 255)
  return {
    backgroundColor: `rgb(${channel}, ${channel}, ${channel})`
  }
})
</script>

<style scoped>
.layer-mask-cursor {
  position: absolute;
  pointer-events: none;
  color: #fff;
  z-index: 5;
}

.layer-mask-cursor__icon {
  position: absolute;
  font-size: 0.85rem;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 4px rgba(0, 0, 0, 0.75);
}

.layer-mask-cursor__icon :deep(svg) {
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.7));
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

.layer-mask-cursor__swatch {
  position: absolute;
  left: 0;
  top: 0;
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.85);
  transform: translate(0.3rem, -2.4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 4px rgba(0, 0, 0, 0.75);
}

.layer-mask-cursor__target-dot {
  position: absolute;
  left: 0;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.85),
    0 0 0 4px rgba(255, 255, 255, 0.4);
  transform: translate(-50%, -50%);
}
</style>
