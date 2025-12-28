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
      <div class="panel-card__header-main settings-panel__section">
        <Icon icon="sliders">Viewer</Icon>
      </div>
      <label class="settings-panel__label">
        Viewer Scale
        <select v-model="localSettings.renderScaleMode" class="settings-panel__select">
          <option v-for="option in renderScaleOptions" :key="option.mode" :value="option.mode">
            {{ option.label }}
          </option>
        </select>
      </label>
      <p class="panel-card__hint">
        Auto lowers render scale by 40% when FPS fails to stabilize.
      </p>
      <p class="panel-card__hint settings-panel__resolution">
        Render buffer: {{ renderResolution.width }} x {{ renderResolution.height }} px
        · DPR {{ renderResolution.pixelRatio.toFixed(2) }} · Scale {{ renderResolution.renderScale.toFixed(2) }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { LocalSettings, RenderScaleMode } from '../../composables/useLocalSettings'
import Icon from '../Icon.vue'

const renderScaleOptions: { mode: RenderScaleMode; label: string }[] = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'very-low', label: 'Very Low' },
  { mode: 'low', label: 'Low' },
  { mode: 'medium', label: 'Medium' },
  { mode: 'high', label: 'High' },
  { mode: 'max', label: 'Max' }
]

defineProps<{
  localSettings: LocalSettings
  renderResolution: { width: number; height: number; pixelRatio: number; renderScale: number }
}>()
</script>

<style scoped>
.settings-panel__section {
  margin-top: 1.5rem;
}

.settings-panel__label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.5rem 0 0.75rem;
  font-size: 0.9rem;
}

.settings-panel__select {
  appearance: none;
  background: rgba(6, 8, 10, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: inherit;
  padding: 0.45rem 0.75rem;
  font-size: 0.95rem;
}

.settings-panel__resolution {
  font-variant-numeric: tabular-nums;
}
</style>
