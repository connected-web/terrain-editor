<template>
  <span class="icon-with-label" :class="{ rtl }">
    <span class="icon-wrapper">
      <font-awesome-icon :icon="iconPlusStyle" />
    </span>
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon?: string
  rtl?: boolean
}>()

const brandIcons = ['jira', 'github']

const iconPlusStyle = computed(() => {
  const iconName = props.icon ?? 'user-secret'
  if (brandIcons.includes(iconName)) {
    return ['fab', iconName]
  }
  return ['fas', iconName]
})
</script>

<style scoped>
.icon-with-label {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  gap: 0.25rem;
}

.icon-wrapper {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 1.4em;
  height: 1.4em;
  text-align: center;
  vertical-align: middle;
  user-select: none;
}

.icon-with-label.rtl {
  flex-direction: row-reverse;
}
</style>
