<template>
  <section class="panel-card panel-card--locations">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="location-dot">Locations</Icon>
      </div>
      <button class="pill-button pill-button--ghost" @click="addLocation" :disabled="!hasLegend">
        <Icon icon="plus">Add location</Icon>
      </button>
    </header>
    <div class="locations-panel__selector">
      <button
        class="pill-button locations-panel__selector-button"
        type="button"
        :disabled="!locationsList.length"
        @click="$emit('open-picker')"
      >
        <Icon icon="location-crosshairs" />
        <div class="locations-panel__selector-text">
          <strong>{{ activeLocation?.name || activeLocation?.id || 'Select a location' }}</strong>
          <small v-if="activeLocation">
            {{ activeLocation.pixel.x }}, {{ activeLocation.pixel.y }}
          </small>
        </div>
      </button>
      <p v-if="!locationsList.length" class="panel-card__placeholder locations-panel__placeholder">
        No locations yet. Import a map with locations or add them manually.
      </p>
    </div>
    <div
      v-if="activeLocation"
      class="locations-panel"
      :class="{ 'drag-active': locationsDragActive }"
      @dragenter="$emit('drag-enter', $event)"
      @dragover="$emit('drag-enter', $event)"
      @dragleave="$emit('drag-leave', $event)"
      @drop="$emit('drop', $event)"
    >
      <article class="locations-panel__item">
        <div class="locations-panel__preview">
          <div
            class="locations-panel__icon button"
            :class="{ 'locations-panel__icon--ghost': activeLocation.showBorder === false }"
            :style="{ backgroundImage: getIconPreview(activeLocation.icon) ? `url('${getIconPreview(activeLocation.icon)}')` : undefined }"
            @click="$emit('open-icon-picker', activeLocation)"
          >
            <span v-if="!getIconPreview(activeLocation.icon)">{{ activeLocation.name?.[0] ?? '?' }}</span>
          </div>
          <div class="locations-panel__preview-actions">
            <button type="button" class="pill-button" @click="$emit('open-icon-picker', activeLocation)">
              <Icon icon="images">Choose icon</Icon>
            </button>
            <button
              type="button"
              class="pill-button pill-button--ghost"
              @click="$emit('clear-icon', activeLocation)"
              :disabled="!activeLocation.icon"
            >
              <Icon icon="ban">Clear icon</Icon>
            </button>
            <button type="button" class="pill-button pill-button--ghost" @click="startPlacement(activeLocation)">
              <Icon icon="crosshairs">Pick on map</Icon>
            </button>
          </div>
        </div>
        <label class="locations-panel__field">
          <span>Name</span>
          <input
            type="text"
            v-model="activeLocation.name"
            @blur="commitLocations"
            placeholder="Location name"
          />
        </label>
        <label class="locations-panel__field">
          <span>Icon reference</span>
          <input
            type="text"
            v-model="activeLocation.icon"
            @blur="commitLocations"
            placeholder="e.g. icons/castle.png"
          />
        </label>
        <div class="locations-panel__coords">
          <label>
            <span>X</span>
            <input
              type="number"
              min="0"
              :max="workspaceForm.width"
              :step="locationStepX"
              v-model.number="activeLocation.pixel.x"
              @change="clampLocationPixel(activeLocation)"
            />
          </label>
          <label>
            <span>Y</span>
            <input
              type="number"
              min="0"
              :max="workspaceForm.height"
              :step="locationStepY"
              v-model.number="activeLocation.pixel.y"
              @change="clampLocationPixel(activeLocation)"
            />
          </label>
        </div>
        <div class="locations-panel__coords locations-panel__coords--view">
          <label>
            <span>Camera distance</span>
            <input
              type="number"
              step="0.01"
              :value="activeLocation.view?.distance ?? ''"
              @change="updateActiveLocationViewField('distance', ($event.target as HTMLInputElement).value)"
              placeholder="auto"
            />
          </label>
          <label>
            <span>Polar (rad)</span>
            <input
              type="number"
              step="0.01"
              :value="activeLocation.view?.polar ?? ''"
              @change="updateActiveLocationViewField('polar', ($event.target as HTMLInputElement).value)"
              placeholder="auto"
            />
          </label>
          <label>
            <span>Azimuth (rad)</span>
            <input
              type="number"
              step="0.01"
              :value="activeLocation.view?.azimuth ?? ''"
              @change="updateActiveLocationViewField('azimuth', ($event.target as HTMLInputElement).value)"
              placeholder="auto"
            />
          </label>
        </div>
        <div class="locations-panel__preview-actions locations-panel__preview-actions--compact">
          <button
            type="button"
            class="pill-button"
            @click="captureCameraViewForActiveLocation"
            :disabled="disableCameraActions"
          >
            <Icon icon="camera">Use current camera</Icon>
          </button>
          <button
            type="button"
            class="pill-button pill-button--ghost"
            @click="clearActiveLocationView"
            :disabled="!activeLocation.view"
          >
            <Icon icon="eraser">Clear camera view</Icon>
          </button>
        </div>
        <label class="locations-panel__toggle">
          <input type="checkbox" v-model="activeLocation.showBorder" @change="commitLocations" />
          <span>Show label border</span>
        </label>
        <button type="button" class="pill-button pill-button--danger" @click="removeLocation(activeLocation)">
          <Icon icon="trash">Remove location</Icon>
        </button>
      </article>
    </div>
    <p v-else-if="locationsList.length" class="panel-card__placeholder">Select a location to edit.</p>
  </section>
</template>

<script setup lang="ts">
import type { TerrainLocation } from '@connected-web/terrain-editor'
import Icon from '../Icon.vue'
import { useWorkspaceModel } from '../../models/workspace'
import type { LocationsApi } from '../../composables/useLocations'

const props = defineProps<{
  locationsApi: LocationsApi
  getIconPreview: (icon?: string) => string
  hasLegend: boolean
  disableCameraActions?: boolean
}>()

const {
  locationsList,
  activeLocation,
  locationStepX,
  locationStepY,
  locationsDragActive,
  addLocation,
  startPlacement,
  clampLocationPixel,
  commitLocations,
  removeLocation,
  updateActiveLocationViewField,
  captureCameraViewForActiveLocation,
  clearActiveLocationView
} = props.locationsApi

const { workspaceForm } = useWorkspaceModel()

defineEmits<{
  'open-picker': []
  'open-icon-picker': [location: TerrainLocation]
  'clear-icon': [location: TerrainLocation]
  'drag-enter': [event: DragEvent]
  'drag-leave': [event: DragEvent]
  drop: [event: DragEvent]
}>()
</script>
