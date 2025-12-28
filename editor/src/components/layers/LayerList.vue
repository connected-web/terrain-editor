<template>
  <div class="layer-list">
    <div
      class="layer-list__scroll"
      @dragover.prevent="handleListDragOver"
      @drop.prevent="handleListDrop"
    >
      <template v-for="section in sections" :key="section.key">
        <div class="layer-list__section-heading">
          <p class="layer-list__section-label">{{ section.label }}</p>
          <Icon v-if="sectionHints?.[section.key]"
            icon="circle-info"
            :title="sectionHints?.[section.key]"
            class="layer-list__section-hint" />
            <span class="spacer"></span>
        </div>
        <div class="layer-list__section" :data-section-key="section.key">
          <div
            v-for="entry in section.entries"
            :key="entry.id"
            class="layer-list__pill"
            :class="pillClasses(entry)"
            :draggable="entry.kind !== 'heightmap'"
            role="button"
            tabindex="0"
            :title="entry.label"
            @click="emit('open-layer', entry.id)"
            @keydown.enter.prevent="emit('open-layer', entry.id)"
            @keydown.space.prevent="emit('open-layer', entry.id)"
            @dragstart="handleDragStart(entry, $event)"
            @dragover.prevent="handleDragOver(entry, $event)"
            @dragleave="handleDragLeave(entry, $event)"
            @drop.prevent="handleDrop(entry)"
            @dragend="handleDragEnd"
          >
            <span class="layer-list__pill-handle" aria-hidden="true">
              <Icon icon="grip-lines" />
            </span>
            <Icon :icon="entry.icon ?? 'circle'" class="layer-list__pill-icon" :style="{ color: colorToCss(entry.color) }" />
            <span class="layer-list__pill-label">{{ entry.label }}</span>
            <span class="layer-list__pill-spacer"></span>
            <button
              v-if="entry.kind !== 'heightmap'"
              type="button"
              class="layer-list__pill-action"
              title="Toggle visibility"
              @click.stop="emit('toggle-layer', entry.id)"
            >
              <Icon :icon="entry.visible ? 'toggle-on' : 'toggle-off'" />
            </button>
            <button
              type="button"
              class="layer-list__pill-action"
              title="Toggle onion skin"
              @click.stop="emit('toggle-onion', entry.id)"
            >
              <Icon icon="film" :style="{ opacity: entry.onionEnabled ? '1' : '0.4' }" />
            </button>
          </div>
        </div>
        <div
          class="layer-list__drop-zone"
          :class="{ 'layer-list__drop-zone--active': isTailDropActive(section.key) }"
          @dragover.prevent="handleSectionTailDragOver(section.key, $event)"
          @drop.prevent="handleSectionTailDrop(section.key)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LayerEntry } from '../../composables/useLayersModel'
import Icon from '../Icon.vue'
import type { LayerSection, LayerSectionKey } from '../../utils/layerSections'

const props = withDefaults(defineProps<{
  sections: LayerSection[]
  colorToCss: (color: [number, number, number]) => string
  activeId?: string | null
  sectionHints?: Partial<Record<LayerSectionKey, string>>
}>(), {
  activeId: null,
  sectionHints: undefined
})

const emit = defineEmits<{
  (ev: 'open-layer', id: string): void
  (ev: 'toggle-layer', id: string): void
  (ev: 'toggle-onion', id: string): void
  (ev: 'reorder-layer', payload: { sourceId: string; targetId: string | null }): void
}>()

const draggingLayerId = ref<string | null>(null)
const draggingLayerKind = ref<LayerSectionKey | null>(null)
const dropHoverState = ref<{ id: string | null; kind: LayerSectionKey | null; position: 'above' | 'below' } | null>(null)
const dragPreviewEl = ref<HTMLElement | null>(null)

function pillClasses(entry: LayerEntry) {
  return {
    'layer-list__pill--inactive': !entry.visible,
    'layer-list__pill--active': props.activeId === entry.id,
    'layer-list__pill--dragging': draggingLayerId.value === entry.id,
    'layer-list__pill--drop-above': isDropAbove(entry.id),
    'layer-list__pill--drop-below': isDropBelow(entry.id)
  }
}

function handleDragStart(entry: LayerEntry, event: DragEvent) {
  if (entry.kind === 'heightmap') {
    event.preventDefault()
    return
  }
  draggingLayerId.value = entry.id
  draggingLayerKind.value = entry.kind as LayerSectionKey
  dropHoverState.value = { id: entry.id, kind: entry.kind as LayerSectionKey, position: 'above' }
  const pill = event.currentTarget as HTMLElement | null
  if (pill && event.dataTransfer) {
    const clone = pill.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.top = '-1000px'
    clone.style.left = '-1000px'
    clone.style.width = `${pill.offsetWidth}px`
    clone.classList.add('layer-list__pill--ghost')
    document.body.appendChild(clone)
    event.dataTransfer.setDragImage(clone, pill.offsetWidth / 2, pill.offsetHeight / 2)
    dragPreviewEl.value = clone
  }
}

function handleDragOver(entry: LayerEntry, event: DragEvent) {
  if (!draggingLayerId.value || !draggingLayerKind.value) return
  if (entry.kind !== draggingLayerKind.value || entry.id === draggingLayerId.value) return
  const pill = event.currentTarget as HTMLElement | null
  if (pill) {
    const rect = pill.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
    dropHoverState.value = { id: entry.id, kind: entry.kind as LayerSectionKey, position }
  }
  event.preventDefault()
}

function handleDrop(entry: LayerEntry) {
  if (!draggingLayerId.value || !draggingLayerKind.value) return
  if (entry.kind !== draggingLayerKind.value || entry.id === draggingLayerId.value) return
  const targetId = resolveDropTarget(entry.id, entry.kind as LayerSectionKey)
  emit('reorder-layer', { sourceId: draggingLayerId.value, targetId })
  clearDragState()
}

function resolveDropTarget(entryId: string, kind: LayerSectionKey) {
  if (dropHoverState.value?.position === 'below') {
    const nextId = findNextLayerId(entryId, kind)
    return nextId ?? null
  }
  return entryId
}

function findNextLayerId(entryId: string, kind: LayerSectionKey) {
  const entries = props.sections.find((section) => section.key === kind)?.entries ?? []
  const index = entries.findIndex((entry) => entry.id === entryId)
  if (index === -1) return null
  return entries[index + 1]?.id ?? null
}

function handleDragLeave(entry: LayerEntry, event: DragEvent) {
  const related = event.relatedTarget as HTMLElement | null
  if (related && related.closest('.layer-list__pill') === event.currentTarget) return
  if (dropHoverState.value?.id === entry.id) {
    dropHoverState.value = null
  }
}

function handleDragEnd() {
  clearDragState()
}

function handleListDragOver(event: DragEvent) {
  if (!draggingLayerId.value) return
  event.preventDefault()
}

function handleListDrop() {
  if (!draggingLayerId.value) return
  emit('reorder-layer', { sourceId: draggingLayerId.value, targetId: null })
  clearDragState()
}

function handleSectionTailDragOver(kind: LayerSectionKey, event: DragEvent) {
  if (!draggingLayerId.value || draggingLayerKind.value !== kind) return
  dropHoverState.value = { id: null, kind, position: 'below' }
  event.preventDefault()
}

function handleSectionTailDrop(kind: LayerSectionKey) {
  if (!draggingLayerId.value || draggingLayerKind.value !== kind) return
  emit('reorder-layer', { sourceId: draggingLayerId.value, targetId: null })
  clearDragState()
}

function clearDragState() {
  draggingLayerId.value = null
  draggingLayerKind.value = null
  dropHoverState.value = null
  if (dragPreviewEl.value) {
    document.body.removeChild(dragPreviewEl.value)
    dragPreviewEl.value = null
  }
}

function isDropAbove(id: string) {
  return dropHoverState.value?.id === id && dropHoverState.value?.position === 'above'
}

function isDropBelow(id: string) {
  return dropHoverState.value?.id === id && dropHoverState.value?.position === 'below'
}

function isTailDropActive(kind: LayerSectionKey) {
  return dropHoverState.value?.id === null && dropHoverState.value?.kind === kind
}
</script>

<style scoped>
.layer-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layer-list__scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.2rem 0.2rem 0.2rem 0.2rem;
  scrollbar-gutter: stable;
}

.layer-list__scroll::-webkit-scrollbar {
  width: 6px;
}

.layer-list__scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
}

.layer-list__scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 999px;
}

.layer-list__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.layer-list__section-label {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}

.layer-list__section-hint {
  margin: 0;
  font-size: 0.7rem;
  opacity: 0.55;
}

.layer-list__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-list__pill {
  display: flex;
  align-items: center;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.4rem 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  position: relative;
}

.layer-list__pill--active {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.12);
}

.layer-list__pill--inactive {
  opacity: 0.55;
}

.layer-list__pill--dragging {
  opacity: 0.3;
}

.layer-list__pill::before,
.layer-list__pill::after {
  content: '';
  position: absolute;
  left: 0.6rem;
  right: 0.6rem;
  height: 2px;
  background: #f7c948;
  opacity: 0;
  pointer-events: none;
}

.layer-list__pill::before {
  top: -3px;
}

.layer-list__pill::after {
  bottom: -3px;
}

.layer-list__pill--drop-above::before,
.layer-list__pill--drop-below::after {
  opacity: 1;
}

.layer-list__pill-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  opacity: 0.6;
  margin-right: 0.25rem;
}

.layer-list__pill--ghost {
  pointer-events: none;
  opacity: 0.85;
  z-index: 9999;
}

.layer-list__pill--ghost .layer-list__pill-action {
  display: none;
}

.layer-list__pill-icon {
  margin-right: 0.4rem;
}

.layer-list__pill-label {
  font-size: 0.85rem;
}

.layer-list__pill-spacer {
  flex: 1;
}

.layer-list__pill-action {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.15rem;
}

.layer-list__drop-zone {
  height: 0.5rem;
  margin: 0.2rem 0 0.4rem;
  border-radius: 4px;
  border: 1px dashed transparent;
}

.layer-list__drop-zone--active {
  border-color: rgba(247, 201, 72, 0.8);
  background: rgba(247, 201, 72, 0.12);
}
</style>
