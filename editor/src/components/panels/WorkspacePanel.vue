<template>
  <section class="panel-card">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="compass-drafting">Workspace</Icon>
      </div>
      <button
        class="pill-button pill-button--ghost"
        @click="workspaceActions.resetWorkspaceForm()"
        :disabled="!hasActiveArchive"
      >
        Reset
      </button>
    </header>
    <div v-if="!hasActiveArchive" class="workspace-form__starter">
      <button
        type="button"
        class="pill-button"
        aria-label="Workspace panel: load sample map"
        @click="$emit('load-sample')"
      >
        <Icon icon="mountain-sun">Load sample map</Icon>
      </button>
      <button
        type="button"
        class="pill-button pill-button--ghost"
        aria-label="Workspace panel: load map"
        @click="$emit('load-map')"
      >
        <Icon icon="folder-open">Load map</Icon>
      </button>
    </div>
    <div class="workspace-form">
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
}>()

const { workspaceForm, actions: workspaceActions } = useWorkspaceModel()

defineEmits<{
  'load-sample': []
  'load-map': []
  'export-archive': []
}>()
</script>
