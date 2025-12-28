<template>
  <section class="panel-card">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="compass-drafting">Workspace</Icon>
      </div>
    </header>
    <div v-if="!hasActiveArchive" class="workspace-panel__empty">
      <div class="workspace-panel__empty-copy">
        <p class="workspace-panel__empty-title">No map loaded</p>
        <p class="workspace-panel__empty-body">
          Start a fresh project with blank terrain, preview the bundled sample, or open an existing .wyn archive.
        </p>
      </div>
      <div class="workspace-panel__empty-actions">
        <button
          type="button"
          class="pill-button pill-button--primary"
          aria-label="Workspace panel: create empty project"
          @click="$emit('start-new')"
        >
          <Icon icon="file-circle-plus">Create empty project</Icon>
        </button>
        <div class="workspace-panel__sample-row">
          <label class="workspace-panel__sample-label">
            <span>Sample map</span>
            <select
              :value="sampleMapId ?? ''"
              @change="$emit('select-sample', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Select sample map to load…</option>
              <option v-for="entry in sampleMaps" :key="entry.id" :value="entry.id" :disabled="entry.status !== 'available'">
                {{ entry.title }} · {{ entry.date }}{{ entry.status !== 'available' ? ' (planned)' : '' }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="pill-button"
            aria-label="Workspace panel: load sample map"
            :disabled="!sampleMapId"
            @click="$emit('load-sample', sampleMapId)"
          >
            <Icon icon="mountain-sun">Load sample map</Icon>
          </button>
        </div>
        <button
          type="button"
          class="pill-button pill-button--ghost"
          aria-label="Workspace panel: load map"
          @click="$emit('load-map')"
        >
          <Icon icon="folder-open">Load map</Icon>
        </button>
      </div>
    </div>
    <div v-else class="workspace-form">
      <label class="workspace-form__field">
        <span>Project title</span>
        <input
          type="text"
          v-model="workspaceForm.label"
          @change="workspaceActions.updateProjectLabel(workspaceForm.label)"
        />
      </label>
      <label class="workspace-form__field">
        <span>Author</span>
        <input
          type="text"
          v-model="workspaceForm.author"
          @change="workspaceActions.updateProjectAuthor(workspaceForm.author)"
        />
      </label>
      <div class="workspace-form__split">
        <label class="workspace-form__field">
          <span>Map width (px)</span>
          <input
            type="number"
            min="1"
            v-model.number="workspaceForm.width"
            @change="workspaceActions.applyMapSize()"
          />
        </label>
        <label class="workspace-form__field">
          <span>Map height (px)</span>
          <input
            type="number"
            min="1"
            v-model.number="workspaceForm.height"
            @change="workspaceActions.applyMapSize()"
          />
        </label>
      </div>
      <label class="workspace-form__field">
        <span>Sea level</span>
        <div class="workspace-form__range">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="workspaceForm.seaLevel"
            @input="workspaceActions.applySeaLevel()"
          />
          <input
            type="number"
            step="0.01"
            v-model.number="workspaceForm.seaLevel"
            @change="workspaceActions.applySeaLevel()"
          />
        </div>
      </label>
      <p class="workspace-form__hint">
        Map size is used when validating layer imports. Sea level adjusts how water layers are rendered.
      </p>
      <div class="workspace-form__thumbnail">
        <div class="workspace-form__thumbnail-preview">
          <div
            class="workspace-form__thumbnail-image"
            :class="{
              'workspace-form__thumbnail-image--empty': !thumbnailUrl,
              'workspace-form__thumbnail-image--busy': isCreatingThumbnail
            }"
            :style="thumbnailUrl ? { backgroundImage: `url('${thumbnailUrl}')` } : undefined"
          >
            <span v-if="isCreatingThumbnail">Creating thumbnail...</span>
            <span v-else-if="!thumbnailUrl">No thumbnail</span>
          </div>
        </div>
        <div class="workspace-form__thumbnail-actions">
          <button class="pill-button pill-button--ghost" type="button" @click="$emit('select-thumbnail')">
            <Icon icon="image">Select thumbnail</Icon>
          </button>
          <button
            class="pill-button"
            type="button"
            :disabled="isCreatingThumbnail"
            @click="$emit('capture-thumbnail')"
          >
            <Icon icon="camera">Create from view</Icon>
          </button>
        </div>
      </div>
      <div class="workspace-form__actions" v-if="hasActiveArchive">
        <button class="pill-button pill-button--ghost" type="button" @click="$emit('export-archive')">
          <Icon icon="file-export">Export WYN</Icon>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import Icon from '../Icon.vue'
import { useWorkspaceModel } from '../../models/workspace'

defineProps<{
  hasActiveArchive: boolean
  thumbnailUrl?: string
  hasThumbnail?: boolean
  isCreatingThumbnail?: boolean
  sampleMaps: Array<{ id: string; title: string; date: string; status: 'available' | 'planned' }>
  sampleMapId?: string | null
}>()

const { workspaceForm, actions: workspaceActions } = useWorkspaceModel()

defineEmits<{
  'load-sample': [id?: string | null]
  'select-sample': [id: string]
  'load-map': []
  'start-new': []
  'export-archive': []
  'select-thumbnail': []
  'capture-thumbnail': []
}>()
</script>

<style scoped>
.workspace-panel__empty {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0 1rem;
}

.workspace-panel__empty-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.workspace-panel__empty-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.workspace-panel__empty-body {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.8;
}

.workspace-panel__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workspace-panel__sample-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workspace-panel__sample-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.workspace-panel__sample-label select {
  background: rgba(6, 8, 10, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: inherit;
  padding: 0.35rem 0.6rem;
}

.workspace-form__range {
  display: flex;
  flex-direction: row;
  gap: 1rem;
}

.workspace-form__thumbnail {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.6rem;
  padding: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
}

.workspace-form__thumbnail-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace-form__thumbnail-image {
  width: 100%;
  max-width: 280px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.04);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
}

.workspace-form__thumbnail-image--empty {
  background-image: none;
}

.workspace-form__thumbnail-image--busy {
  color: rgba(255, 255, 255, 0.85);
}

.workspace-form__thumbnail-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pill-button--primary {
  background: rgba(246, 231, 195, 0.15);
  border-color: rgba(246, 231, 195, 0.45);
}
</style>
