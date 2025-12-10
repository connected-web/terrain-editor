<template>
  <section class="panel-card">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="gear">Settings</Icon>
      </div>
      <span class="panel-card__hint">Local to this browser</span>
    </header>
    <div class="panel-card__list">
      <div class="panel-card__header-main">
        <Icon icon="camera">Camera</Icon>
      </div>
      <label class="locations-panel__toggle">
        <input type="checkbox" v-model="localSettings.cameraTracking" />
        <span>Use location camera when moving between locations</span>
      </label>
      <p class="panel-card__hint">
        When enabled, the viewer uses a location’s saved camera view (distance/polar/azimuth) while moving
        between markers instead of reusing the current angle.
      </p>
      <label class="locations-panel__toggle">
        <input type="checkbox" v-model="localSettings.openLocationsOnSelect" />
        <span>Open Locations panel when selecting from viewer</span>
      </label>
      <p class="panel-card__hint">
        Turn off to keep the current panel open when clicking markers in the viewer.
      </p>
      <div class="panel-card__header-main">
        <Icon icon="layer-group">Layer Editor</Icon>
      </div>
      <p class="panel-card__hint">
        Settings for the layer mask editor.
      </p>
      <label class="locations-panel__toggle">
        <input type="checkbox" v-model="localSettings.showLayerTransparencyGrid" />
        <span>Show checker background</span>
      </label>
      <p class="panel-card__hint">
        Toggle between a checkerboard transparency grid and a solid black background in the layer mask editor.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { LocalSettings } from '../../composables/useLocalSettings'
import Icon from '../Icon.vue'

defineProps<{
  localSettings: LocalSettings
}>()
</script>
