<template>
  <section class="panel-card">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="compass-drafting">Workspace</Icon>
      </div>
      <button class="pill-button pill-button--ghost" @click="$emit('reset')" :disabled="!hasActiveArchive">
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
        <input type="text" v-model="workspaceForm.label" @change="$emit('update-label', workspaceForm.label)" />
      </label>
      <label class="workspace-form__field">
        <span>Author</span>
        <input type="text" v-model="workspaceForm.author" @change="$emit('update-author', workspaceForm.author)" />
      </label>
      <div class="workspace-form__split">
        <label class="workspace-form__field">
          <span>Map width (px)</span>
          <input type="number" min="1" v-model.number="workspaceForm.width" @change="$emit('apply-map-size')" />
        </label>
        <label class="workspace-form__field">
          <span>Map height (px)</span>
          <input type="number" min="1" v-model.number="workspaceForm.height" @change="$emit('apply-map-size')" />
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
            @input="$emit('apply-sea-level')"
          />
          <input
            type="number"
            step="0.01"
            v-model.number="workspaceForm.seaLevel"
            @change="$emit('apply-sea-level')"
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

defineProps<{
  workspaceForm: {
    label: string
    author: string
    width: number
    height: number
    seaLevel: number
  }
  hasActiveArchive: boolean
}>()

defineEmits<{
  'load-sample': []
  'load-map': []
  reset: []
  'update-label': [value: string]
  'update-author': [value: string]
  'apply-map-size': []
  'apply-sea-level': []
  'export-archive': []
}>()
</script>
