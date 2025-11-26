<template>
  <div class="editor-shell" ref="editorRoot">
    <h1 class="sr-only">Terrain Editor</h1>
    <div class="editor-layout">
      <EditorViewer
        ref="viewerShell"
        class="viewer-surface"
        :status="status"
        :status-fade="statusFaded"
        :ui-actions="uiActions"
        :show-toolbar-labels="isDockCollapsed"
        @load-file="loadArchiveFromFile"
        @toggle-fullscreen="toggleEditorFullscreen"
      />
      <PanelDock
        :collapsed="isDockCollapsed"
        :mobile="isCompactViewport"
        @toggle="toggleDock"
      >

        <section v-if="activeDockPanel === 'workspace'" class="panel-card">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="compass-drafting">Workspace</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="resetWorkspaceForm" :disabled="!hasActiveArchive">
              Reset
            </button>
          </header>
          <div v-if="!hasActiveArchive" class="workspace-form__starter">
            <button
              type="button"
              class="pill-button"
              aria-label="Workspace panel: load sample map"
              @click="loadSample"
            >
              <Icon icon="mountain-sun">Load sample map</Icon>
            </button>
            <button
              type="button"
              class="pill-button pill-button--ghost"
              aria-label="Workspace panel: load map"
              @click="viewerShell?.triggerFileSelect()"
            >
              <Icon icon="folder-open">Load map</Icon>
            </button>
          </div>
          <div class="workspace-form">
            <label class="workspace-form__field">
              <span>Project title</span>
              <input type="text" v-model="workspaceForm.label" @change="updateProjectLabel(workspaceForm.label)" />
            </label>
            <label class="workspace-form__field">
              <span>Author</span>
              <input type="text" v-model="workspaceForm.author" @change="updateProjectAuthor(workspaceForm.author)" />
            </label>
            <div class="workspace-form__split">
              <label class="workspace-form__field">
                <span>Map width (px)</span>
                <input
                  type="number"
                  min="1"
                  v-model.number="workspaceForm.width"
                  @change="applyMapSize"
                />
              </label>
              <label class="workspace-form__field">
                <span>Map height (px)</span>
                <input
                  type="number"
                  min="1"
                  v-model.number="workspaceForm.height"
                  @change="applyMapSize"
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
                  @input="applySeaLevel"
                />
                <input
                  type="number"
                  step="0.01"
                  v-model.number="workspaceForm.seaLevel"
                  @change="applySeaLevel"
                />
              </div>
            </label>
            <p class="workspace-form__hint">
              Map size is used when validating layer imports. Sea level adjusts how water layers are rendered.
            </p>
            <div class="workspace-form__actions" v-if="hasActiveArchive">
              <button class="pill-button pill-button--ghost" type="button" @click="exportArchive">
                <Icon icon="file-export">Export WYN</Icon>
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="activeDockPanel === 'layers'" class="panel-card">
          <header class="panel-card__header">
            <Icon icon="layer-group">Layers</Icon>
            <span class="panel-card__hint">Toggle biome + overlay visibility</span>
          </header>
          <div v-if="layerEntries.length" class="panel-card__list">
            <button
              v-for="entry in layerEntries"
              :key="entry.id"
              type="button"
              class="pill-button panel-card__pill"
              :class="{ 'panel-card__pill--inactive': !entry.visible }"
              @click="toggleLayer(entry.id)"
            >
              <span class="panel-card__pill-swatch" :style="{ backgroundColor: rgb(entry.color) }" />
              <span class="panel-card__pill-label">{{ entry.label }}</span>
            </button>
            <div class="panel-card__pill-actions">
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('biome', true)">
                Show all biomes
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('biome', false)">
                Hide all biomes
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('overlay', true)">
                Show overlays
              </button>
              <button class="pill-button panel-card__pill-small" @click="setAllLayers('overlay', false)">
                Hide overlays
              </button>
            </div>
          </div>
          <p v-else class="panel-card__placeholder">Legend data not loaded yet.</p>
        </section>

        <section v-else-if="activeDockPanel === 'theme'" class="panel-card panel-card--theme">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="palette">Theme</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="resetThemeForm" :disabled="!hasActiveArchive">
              Reset
            </button>
          </header>
          <div class="theme-form">
            <section class="theme-form__section">
              <header>
                <h4>Label styling</h4>
                <p>Adjust sprite colors + border thickness.</p>
              </header>
              <label class="theme-form__field">
                <span>Text color</span>
                <input type="color" v-model="themeForm.textColor" @input="scheduleThemeUpdate" />
              </label>
              <label class="theme-form__field">
                <span>Background</span>
                <input type="color" v-model="themeForm.backgroundColor" @input="scheduleThemeUpdate" />
              </label>
              <label class="theme-form__field">
                <span>Border</span>
                <input type="color" v-model="themeForm.borderColor" @input="scheduleThemeUpdate" />
              </label>
              <div class="theme-form__split">
                <label class="theme-form__field">
                  <span>Border thickness</span>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.25"
                    v-model.number="themeForm.borderThickness"
                    @input="scheduleThemeUpdate"
                  />
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.25"
                    v-model.number="themeForm.borderThickness"
                    @change="scheduleThemeUpdate"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    v-model.number="themeForm.opacity"
                    @input="scheduleThemeUpdate"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    v-model.number="themeForm.opacity"
                    @change="scheduleThemeUpdate"
                  />
                </label>
              </div>
            </section>
            <section class="theme-form__section">
              <header>
                <h4>Typography & spacing</h4>
                <p>Control font + padding used across label states.</p>
              </header>
              <label class="theme-form__field">
                <span>Font family</span>
                <input type="text" v-model="themeForm.fontFamily" @change="scheduleThemeUpdate" />
              </label>
              <div class="theme-form__split">
                <label class="theme-form__field">
                  <span>Font weight</span>
                  <input type="text" v-model="themeForm.fontWeight" @change="scheduleThemeUpdate" />
                </label>
                <label class="theme-form__field">
                  <span>Min font size</span>
                  <input
                    type="number"
                    min="4"
                    max="64"
                    step="1"
                    v-model.number="themeForm.minFontSize"
                    @change="scheduleThemeUpdate"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Max font size</span>
                  <input
                    type="number"
                    min="4"
                    max="96"
                    step="1"
                    v-model.number="themeForm.maxFontSize"
                    @change="scheduleThemeUpdate"
                  />
                </label>
              </div>
              <div class="theme-form__split">
                <label class="theme-form__field">
                  <span>Padding X</span>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    step="1"
                    v-model.number="themeForm.paddingX"
                    @change="scheduleThemeUpdate"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Padding Y</span>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    step="1"
                    v-model.number="themeForm.paddingY"
                    @change="scheduleThemeUpdate"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Border radius</span>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    step="1"
                    v-model.number="themeForm.borderRadius"
                    @change="scheduleThemeUpdate"
                  />
                </label>
              </div>
            </section>
            <section class="theme-form__section">
              <header class="theme-form__section-header">
                <div class="theme-form__section-text">
                  <h4>Hover state</h4>
                  <p class="theme-form__state-hint" v-if="!themeForm.hoverEnabled">
                    Inherits the default label styling until you edit a field.
                  </p>
                </div>
                <button
                  type="button"
                  class="pill-button pill-button--ghost"
                  @click="resetSpriteState('hover')"
                  :disabled="!themeForm.hoverEnabled"
                >
                  Use default
                </button>
              </header>
              <div class="theme-form__state-grid">
                <label class="theme-form__field">
                  <span>Text</span>
                  <input
                    type="color"
                    v-model="themeForm.hover.textColor"
                    @input="handleSpriteStateInput('hover')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Background</span>
                  <input
                    type="color"
                    v-model="themeForm.hover.backgroundColor"
                    @input="handleSpriteStateInput('hover')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Border</span>
                  <input
                    type="color"
                    v-model="themeForm.hover.borderColor"
                    @input="handleSpriteStateInput('hover')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Thickness</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.25"
                    v-model.number="themeForm.hover.borderThickness"
                    @input="handleSpriteStateInput('hover')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Opacity</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    v-model.number="themeForm.hover.opacity"
                    @input="handleSpriteStateInput('hover')"
                  />
                </label>
              </div>
            </section>
            <section class="theme-form__section">
              <header class="theme-form__section-header">
                <div class="theme-form__section-text">
                  <h4>Focus state</h4>
                  <p class="theme-form__state-hint" v-if="!themeForm.focusEnabled">
                    Inherits the default label styling until you edit a field.
                  </p>
                </div>
                <button
                  type="button"
                  class="pill-button pill-button--ghost"
                  @click="resetSpriteState('focus')"
                  :disabled="!themeForm.focusEnabled"
                >
                  Use default
                </button>
              </header>
              <div class="theme-form__state-grid">
                <label class="theme-form__field">
                  <span>Text</span>
                  <input
                    type="color"
                    v-model="themeForm.focus.textColor"
                    @input="handleSpriteStateInput('focus')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Background</span>
                  <input
                    type="color"
                    v-model="themeForm.focus.backgroundColor"
                    @input="handleSpriteStateInput('focus')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Border</span>
                  <input
                    type="color"
                    v-model="themeForm.focus.borderColor"
                    @input="handleSpriteStateInput('focus')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Thickness</span>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.25"
                    v-model.number="themeForm.focus.borderThickness"
                    @input="handleSpriteStateInput('focus')"
                  />
                </label>
                <label class="theme-form__field">
                  <span>Opacity</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    v-model.number="themeForm.focus.opacity"
                    @input="handleSpriteStateInput('focus')"
                  />
                </label>
              </div>
            </section>
            <section class="theme-form__section">
              <header>
                <h4>Marker stem</h4>
                <p>Set supporting rod tint + opacity.</p>
              </header>
              <label class="theme-form__field">
                <span>Stem shape</span>
                <select v-model="themeForm.stemShape" @change="scheduleThemeUpdate">
                  <option v-for="shape in stemShapeOptions" :key="shape" :value="shape">
                    {{ shape }}
                  </option>
                </select>
              </label>
              <label class="theme-form__field">
                <span>Stem color</span>
                <input type="color" v-model="themeForm.stemColor" @input="scheduleThemeUpdate" />
              </label>
              <label class="theme-form__field">
                <span>Stem opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.stemOpacity"
                  @input="scheduleThemeUpdate"
                />
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model.number="themeForm.stemOpacity"
                  @change="scheduleThemeUpdate"
                />
              </label>
              <div class="theme-form__state-block">
                <div class="theme-form__state-header">
                  <h5>Hover stem</h5>
                  <button
                    type="button"
                    class="pill-button pill-button--ghost"
                    @click="resetStemState('hover')"
                    :disabled="!themeForm.stemHoverEnabled"
                  >
                    Use default
                  </button>
                </div>
                <div class="theme-form__state-grid">
                  <label class="theme-form__field">
                    <span>Color</span>
                    <input
                      type="color"
                      v-model="themeForm.stemHover.color"
                      @input="handleStemStateInput('hover')"
                    />
                  </label>
                  <label class="theme-form__field">
                    <span>Opacity</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      v-model.number="themeForm.stemHover.opacity"
                      @input="handleStemStateInput('hover')"
                    />
                  </label>
                </div>
              </div>
              <div class="theme-form__state-block">
                <div class="theme-form__state-header">
                  <h5>Focus stem</h5>
                  <button
                    type="button"
                    class="pill-button pill-button--ghost"
                    @click="resetStemState('focus')"
                    :disabled="!themeForm.stemFocusEnabled"
                  >
                    Use default
                  </button>
                </div>
                <div class="theme-form__state-grid">
                  <label class="theme-form__field">
                    <span>Color</span>
                    <input
                      type="color"
                      v-model="themeForm.stemFocus.color"
                      @input="handleStemStateInput('focus')"
                    />
                  </label>
                  <label class="theme-form__field">
                    <span>Opacity</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      v-model.number="themeForm.stemFocus.opacity"
                      @input="handleStemStateInput('focus')"
                    />
                  </label>
                </div>
              </div>
            </section>
            <p class="theme-form__hint">
              Theme changes debounce automatically so rapid color tweaks don’t stall the viewer.
            </p>
          </div>
        </section>

        <section v-else-if="activeDockPanel === 'settings'" class="panel-card">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="gear">Settings</Icon>
            </div>
            <span class="panel-card__hint">Local to this browser</span>
          </header>
          <div class="panel-card__list">
            <label class="locations-panel__toggle">
              <input type="checkbox" v-model="localSettings.cameraTracking" />
              <span>Camera tracking between locations</span>
            </label>
            <p class="panel-card__hint">
              When enabled, the viewer uses a location’s saved camera view (distance/polar/azimuth) while
              moving between markers instead of reusing the current angle.
            </p>
            <label class="locations-panel__toggle">
              <input type="checkbox" v-model="localSettings.openLocationsOnSelect" />
              <span>Open Locations panel when selecting from viewer</span>
            </label>
            <p class="panel-card__hint">
              Turn off to keep the current panel open when clicking markers in the viewer.
            </p>
          </div>
        </section>

        <section v-else class="panel-card panel-card--locations">
          <header class="panel-card__header panel-card__header--split">
            <div class="panel-card__header-main">
              <Icon icon="location-dot">Locations</Icon>
            </div>
            <button class="pill-button pill-button--ghost" @click="addLocation" :disabled="!projectSnapshot.legend">
              <Icon icon="plus">Add location</Icon>
            </button>
          </header>
          <div class="locations-panel__selector">
            <button
              class="pill-button locations-panel__selector-button"
              type="button"
              :disabled="!locationsList.length"
              @click="openLocationPicker"
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
            @dragenter="onLocationsDragEnter"
            @dragover="onLocationsDragEnter"
            @dragleave="onLocationsDragLeave"
            @drop="onLocationsDrop"
          >
            <article class="locations-panel__item">
              <div class="locations-panel__preview">
                <div
                  class="locations-panel__icon button"
                  :class="{ 'locations-panel__icon--ghost': activeLocation.showBorder === false }"
                  :style="{ backgroundImage: getIconPreview(activeLocation.icon) ? `url('${getIconPreview(activeLocation.icon)}')` : undefined }"
                  @click="openIconPicker(activeLocation)"
                >
                  <span v-if="!getIconPreview(activeLocation.icon)">{{ activeLocation.name?.[0] ?? '?' }}</span>
                </div>
                <div class="locations-panel__preview-actions">
                  <button type="button" class="pill-button" @click="openIconPicker(activeLocation)">
                    <Icon icon="images">Choose icon</Icon>
                  </button>
                  <button
                    type="button"
                    class="pill-button pill-button--ghost"
                    @click="clearLocationIcon(activeLocation)"
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
                  :disabled="!handle"
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
              <button type="button" class="pill-button pill-button--danger" @click="confirmRemoveLocation(activeLocation)">
                <Icon icon="trash">Remove location</Icon>
              </button>
            </article>
          </div>
          <p v-else-if="locationsList.length" class="panel-card__placeholder">Select a location to edit.</p>
        </section>
      </PanelDock>
      <input
        type="file"
        accept="image/*"
        class="sr-only"
        ref="iconLibraryInputRef"
        @change="handleLibraryUpload"
      />
      <AssetDialog
        v-if="iconPickerTarget"
        :assets="projectAssets"
        :get-preview="getIconPreview"
        :filter-text="assetDialogFilter"
        @update:filter-text="setAssetDialogFilter"
        @select="selectIconFromLibrary"
        @replace="beginAssetReplacement"
        @upload="() => triggerLibraryUpload()"
        @remove="removeAsset"
        @close="closeIconPicker"
      />
      <LocationPickerDialog
        v-if="locationPickerOpen"
        :locations="locationsList"
        :active-id="selectedLocationId || undefined"
        @select="handleLocationSelect"
        @close="closeLocationPicker"
      />
      <ConfirmDialog
        v-if="confirmState"
        :message="confirmState.message"
        @confirm="handleConfirmDialog"
        @cancel="dismissConfirmDialog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  buildWynArchive,
  createLayerBrowserStore,
  createProjectStore,
  initTerrainViewer,
  loadWynArchiveFromArrayBuffer,
  resolveTerrainTheme,
  type MarkerStemGeometryShape,
  type LayerBrowserState,
  type LayerToggleState,
  type TerrainDataset,
  type TerrainHandle,
  type TerrainLocation,
  type TerrainLegend,
  type TerrainProjectFileEntry,
  type TerrainThemeOverrides,
  type LocationViewState,
  type ViewerOverlayLoadingState
} from '@connected-web/terrain-editor'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  clearPersistedProject,
  persistProjectSnapshot,
  readPersistedProject,
  setAutoRestoreEnabled,
  shouldAutoRestoreProject,
  type PersistedProject
} from './utils/storage'
import {
  SpriteStateKey,
  StemStateKey,
  assignStemState,
  assignThemeState,
  createThemeFormState,
  handleSpriteStateInput as handleSpriteStateInputHelper,
  handleStemStateInput as handleStemStateInputHelper,
  resetSpriteState as resetSpriteStateHelper,
  resetStemState as resetStemStateHelper,
  stemShapeOptions
} from './utils/theme'
import { buildIconPath, normalizeAssetFileName } from './utils/assets'
import { clampNumber, ensureLocationId, getPlacementStep, snapLocationValue } from './utils/locations'
import { useAssetLibrary } from './composables/useAssetLibrary'
import { useLocalSettings } from './composables/useLocalSettings'
import EditorViewer from './components/EditorViewer.vue'
import PanelDock from './components/PanelDock.vue'
import AssetDialog from './components/AssetDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import LocationPickerDialog from './components/LocationPickerDialog.vue'
import type { UIAction } from './types/uiActions'

type DockPanel = 'workspace' | 'layers' | 'theme' | 'locations' | 'settings'

const editorRoot = ref<HTMLElement | null>(null)
const status = ref('Load a Wyn archive to begin.')
const statusFaded = ref(false)
let statusFadeHandle: number | null = null
let statusFadeToken = 0
const interactive = ref(false)
const isDockCollapsed = ref(false)
const isCompactViewport = ref(window.innerWidth < 800)
const activeDockPanel = ref<DockPanel>('workspace')

const workspaceForm = reactive({
  label: '',
  author: '',
  width: 1024,
  height: 1536,
  seaLevel: 0
})

const { localSettings, loadLocalSettings, persistSettings } = useLocalSettings()

const themeForm = createThemeFormState()

function handleSpriteStateInput(state: SpriteStateKey) {
  handleSpriteStateInputHelper(themeForm, state, scheduleThemeUpdate)
}

function resetSpriteState(state: SpriteStateKey) {
  resetSpriteStateHelper(themeForm, state, scheduleThemeUpdate)
}

function handleStemStateInput(state: StemStateKey) {
  handleStemStateInputHelper(themeForm, state, scheduleThemeUpdate)
}

function resetStemState(state: StemStateKey) {
  resetStemStateHelper(themeForm, state, scheduleThemeUpdate)
}

const projectStore = createProjectStore()
const projectSnapshot = ref(projectStore.getSnapshot())
const layerBrowserStore = createLayerBrowserStore()
const layerBrowserState = ref<LayerBrowserState>(layerBrowserStore.getState())
const layerState = ref<LayerToggleState | null>(layerBrowserStore.getLayerToggles())
const datasetRef = ref<TerrainDataset | null>(null)
const locationsList = ref<TerrainLocation[]>([])
const handle = ref<TerrainHandle | null>(null)
const persistedProject = ref<PersistedProject | null>(null)
const viewerShell = ref<InstanceType<typeof EditorViewer> | null>(null)
const hasActiveArchive = computed(() => Boolean(datasetRef.value) || Boolean(projectSnapshot.value.legend))

const {
  assetOverrides,
  iconPreviewCache,
  iconPreviewOwnership,
  missingIconWarnings,
  projectAssets,
  setAssetOverride,
  clearAssetOverrides,
  resolveAssetReference,
  getIconPreview,
  preloadIconPreview,
  refreshIconPreviewCache,
  importIconAsset: importIconAssetHelper,
  replaceAssetWithFile: replaceAssetWithFileHelper,
  removeAsset: removeAssetFromStore,
  disposeAssetPreviewUrls,
  normalizeAssetFileName
} = useAssetLibrary({
  projectStore,
  projectSnapshot,
  datasetRef,
  locationsList,
  handle,
  commitLocations
})

const layerEntries = computed(() => layerBrowserState.value.entries)
const locationsDragActive = ref(false)
const iconPickerTarget = ref<string | null>(null)
const assetDialogFilter = ref('')
function setAssetDialogFilter(value: string) {
  assetDialogFilter.value = value
}
const iconLibraryInputRef = ref<HTMLInputElement | null>(null)
const baseThemeRef = ref<TerrainThemeOverrides | undefined>(undefined)
const selectedLocationId = ref<string | null>(null)
const NEW_LOCATION_PLACEHOLDER = '__pending-location__'
const pendingLocationId = ref<string | null>(null)
const pendingLocationDraft = ref<TerrainLocation | null>(null)
const locationPickerOpen = ref(false)
const confirmState = ref<{ message: string; onConfirm: () => void } | null>(null)
const pendingAssetReplacement = ref<{ path: string; originalName?: string } | null>(null)
const activeLocation = computed(() =>
  locationsList.value.find((location) => ensureLocationId(location).id === selectedLocationId.value) ?? null)
let viewerRemountHandle: number | null = null
let themeUpdateHandle: number | null = null
const locationStepX = computed(() => getPlacementStep(workspaceForm.width))
const locationStepY = computed(() => getPlacementStep(workspaceForm.height))

function requestConfirm(message: string, onConfirm: () => void) {
  confirmState.value = { message, onConfirm }
}

function handleConfirmDialog() {
  const action = confirmState.value?.onConfirm
  confirmState.value = null
  action?.()
}

function dismissConfirmDialog() {
  confirmState.value = null
}

const uiActions = computed<UIAction[]>(() => {
  const actions: UIAction[] = []
  if (!hasActiveArchive.value) {
    actions.push(
      {
        id: 'load-sample',
        icon: 'mountain-sun',
        label: 'Load sample map',
        description: 'Preview the bundled Wynnal terrain archive.',
        callback: () => void loadSample()
      },
      {
        id: 'load-file',
        icon: 'folder-open',
        label: 'Load map',
        description: 'Select a local .wyn archive from disk.',
        callback: () => viewerShell.value?.triggerFileSelect()
      },
      {
        id: 'new-project',
        icon: 'file-circle-plus',
        label: 'New project',
        description: 'Start from an empty workspace.',
        callback: () => startNewMap()
      }
    )
  } else {
    actions.push(
      {
        id: 'workspace',
        icon: 'compass-drafting',
        label: 'Workspace',
        description: 'Jump to the workspace controls.',
        callback: () => {
          setActivePanel('workspace')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'layers',
        icon: 'layer-group',
        label: 'Layers',
        description: 'Jump to the layer controls.',
        callback: () => {
          setActivePanel('layers')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'locations',
        icon: 'location-dot',
        label: 'Locations',
        description: 'Edit location names + icons.',
        callback: () => {
          setActivePanel('locations')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'theme',
        icon: 'palette',
        label: 'Theme',
        description: 'Edit label + marker styling.',
        callback: () => {
          setActivePanel('theme')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'settings',
        icon: 'gear',
        label: 'Settings',
        description: 'Adjust editor preferences + viewer behavior.',
        callback: () => {
          setActivePanel('settings')
          isDockCollapsed.value = false
        }
      },
      {
        id: 'export',
        icon: 'file-export',
        label: 'Export WYN',
        description: 'Download the current project as a Wyn archive.',
        callback: () => void exportArchive()
      },
      {
        id: 'close',
        icon: 'circle-xmark',
        label: 'Close map',
        description: 'Unload the active archive without auto-restoring on refresh.',
        callback: () => promptCloseArchive()
      }
    )
  }
  return actions
})

projectStore.subscribe((snapshot) => {
  projectSnapshot.value = snapshot
  locationsList.value = snapshot.locations
    ? snapshot.locations.map((location) => {
        const copy = ensureLocationId({ ...location })
        if (copy.showBorder === undefined) copy.showBorder = true
        return copy
      })
    : []
  refreshIconPreviewCache()
  ensureActiveLocationSelection()
})

layerBrowserStore.subscribe((state) => {
  layerBrowserState.value = state
  layerState.value = layerBrowserStore.getLayerToggles()
})

watch(
  () => layerState.value,
  async (next) => {
    if (next && handle.value) {
      await handle.value.updateLayers(next)
    }
  }
)

watch(
  () => locationsList.value.map((location) => location.icon),
  () => refreshIconPreviewCache(),
  { deep: true }
)

watch(
  () => projectSnapshot.value,
  (snapshot) => {
    workspaceForm.label = snapshot.metadata.label ?? ''
    workspaceForm.author = snapshot.metadata.author ?? ''
    workspaceForm.width = snapshot.legend?.size?.[0] ?? 1024
    workspaceForm.height = snapshot.legend?.size?.[1] ?? 1536
    workspaceForm.seaLevel = snapshot.legend?.sea_level ?? 0
    syncThemeFormFromSnapshot(snapshot)
  },
  { immediate: true }
)

watch(
  () => selectedLocationId.value,
  (id) => {
    if (id) {
      focusLocationInViewer(id)
    } else if (handle.value) {
      handle.value.updateLocations(getViewerLocations())
    }
  }
)

watch(
  () => locationsList.value.length,
  (count) => {
    if (count === 0) {
      locationPickerOpen.value = false
    }
  }
)

watch(
  () => ({
    cameraTracking: localSettings.cameraTracking,
    openLocationsOnSelect: localSettings.openLocationsOnSelect
  }),
  () => persistSettings()
)

watch(
  () => localSettings.cameraTracking,
  (enabled) => {
    if (enabled && selectedLocationId.value) {
      focusLocationInViewer(selectedLocationId.value)
    }
  }
)

function handleResize() {
  isCompactViewport.value = window.innerWidth < 800
}

function updateStatus(message: string, fadeOutDelay = 0) {
  status.value = message
  statusFaded.value = false
  statusFadeToken += 1
  const token = statusFadeToken
  if (statusFadeHandle !== null) {
    window.clearTimeout(statusFadeHandle)
    statusFadeHandle = null
  }
  if (fadeOutDelay > 0) {
    statusFadeHandle = window.setTimeout(() => {
      if (statusFadeToken === token) {
        statusFaded.value = true
      }
      statusFadeHandle = null
    }, fadeOutDelay)
  }
}

function setOverlayLoading(state: ViewerOverlayLoadingState | null) {
  viewerShell.value?.setOverlayLoading(state)
}

function resetWorkspaceForm() {
  workspaceForm.label = projectSnapshot.value.metadata.label ?? ''
  workspaceForm.author = projectSnapshot.value.metadata.author ?? ''
  workspaceForm.width = projectSnapshot.value.legend?.size?.[0] ?? 1024
  workspaceForm.height = projectSnapshot.value.legend?.size?.[1] ?? 1536
  workspaceForm.seaLevel = projectSnapshot.value.legend?.sea_level ?? 0
}

function syncThemeFormFromSnapshot(snapshot = projectSnapshot.value) {
  const resolved = resolveTerrainTheme(snapshot.theme)
  const sprite = resolved.locationMarkers.sprite
  const spriteDefault = sprite.states.default
  themeForm.textColor = spriteDefault.textColor
  themeForm.backgroundColor = spriteDefault.backgroundColor
  themeForm.borderColor = spriteDefault.borderColor
  themeForm.borderThickness = spriteDefault.borderThickness
  themeForm.opacity = spriteDefault.opacity
  const stemDefault = resolved.locationMarkers.stem.states.default
  themeForm.stemColor = stemDefault.color
  themeForm.stemOpacity = stemDefault.opacity
  themeForm.stemShape = resolved.locationMarkers.stem.shape
  themeForm.fontFamily = sprite.fontFamily
  themeForm.fontWeight = sprite.fontWeight
  themeForm.maxFontSize = sprite.maxFontSize
  themeForm.minFontSize = sprite.minFontSize
  themeForm.paddingX = sprite.paddingX
  themeForm.paddingY = sprite.paddingY
  themeForm.borderRadius = sprite.borderRadius
  const sourceSprite = snapshot.theme?.locationMarkers?.sprite
  const hoverSource = sourceSprite?.states?.hover
  const focusSource = sourceSprite?.states?.focus
  themeForm.hoverEnabled = Boolean(hoverSource)
  themeForm.focusEnabled = Boolean(focusSource)
  assignThemeState(
    themeForm.hover,
    {
      textColor: hoverSource?.textColor ?? spriteDefault.textColor,
      backgroundColor: hoverSource?.backgroundColor ?? spriteDefault.backgroundColor,
      borderColor: hoverSource?.borderColor ?? spriteDefault.borderColor,
      borderThickness: hoverSource?.borderThickness ?? spriteDefault.borderThickness,
      opacity: hoverSource?.opacity ?? spriteDefault.opacity
    }
  )
  assignThemeState(
    themeForm.focus,
    {
      textColor: focusSource?.textColor ?? spriteDefault.textColor,
      backgroundColor: focusSource?.backgroundColor ?? spriteDefault.backgroundColor,
      borderColor: focusSource?.borderColor ?? spriteDefault.borderColor,
      borderThickness: focusSource?.borderThickness ?? spriteDefault.borderThickness,
      opacity: focusSource?.opacity ?? spriteDefault.opacity
    }
  )
  const sourceStem = snapshot.theme?.locationMarkers?.stem
  const stemHoverSource = sourceStem?.states?.hover
  const stemFocusSource = sourceStem?.states?.focus
  themeForm.stemHoverEnabled = Boolean(stemHoverSource)
  themeForm.stemFocusEnabled = Boolean(stemFocusSource)
  assignStemState(
    themeForm.stemHover,
    {
      color: stemHoverSource?.color ?? stemDefault.color,
      opacity: stemHoverSource?.opacity ?? stemDefault.opacity
    }
  )
  assignStemState(
    themeForm.stemFocus,
    {
      color: stemFocusSource?.color ?? stemDefault.color,
      opacity: stemFocusSource?.opacity ?? stemDefault.opacity
    }
  )
}

function updateProjectLabel(value: string) {
  projectStore.updateMetadata({ label: value })
  void persistCurrentProject()
}

function updateProjectAuthor(value: string) {
  projectStore.updateMetadata({ author: value })
  void persistCurrentProject()
}

function resetThemeForm() {
  if (!hasActiveArchive.value) return
  if (baseThemeRef.value) {
    projectStore.setTheme(cloneValue(baseThemeRef.value))
    handle.value?.setTheme(cloneValue(baseThemeRef.value))
  } else {
    projectStore.setTheme(undefined)
    handle.value?.setTheme(undefined)
  }
  syncThemeFormFromSnapshot()
  cancelThemeUpdate()
  void persistCurrentProject()
}

function scheduleThemeUpdate() {
  if (!hasActiveArchive.value) return
  if (themeUpdateHandle) {
    window.clearTimeout(themeUpdateHandle)
  }
  themeUpdateHandle = window.setTimeout(() => {
    themeUpdateHandle = null
    commitThemeOverrides()
  }, 250)
}

function cancelThemeUpdate() {
  if (themeUpdateHandle) {
    window.clearTimeout(themeUpdateHandle)
    themeUpdateHandle = null
  }
}

function commitThemeOverrides() {
  if (!hasActiveArchive.value) return
  const overrides: TerrainThemeOverrides = {
    locationMarkers: {
      sprite: {
        fontFamily: themeForm.fontFamily,
        fontWeight: themeForm.fontWeight,
        maxFontSize: themeForm.maxFontSize,
        minFontSize: themeForm.minFontSize,
        paddingX: themeForm.paddingX,
        paddingY: themeForm.paddingY,
        borderRadius: themeForm.borderRadius,
        states: {
          default: {
            textColor: themeForm.textColor,
            backgroundColor: themeForm.backgroundColor,
            borderColor: themeForm.borderColor,
            borderThickness: themeForm.borderThickness,
            opacity: themeForm.opacity
          },
          ...(themeForm.hoverEnabled
            ? {
                hover: {
                  textColor: themeForm.hover.textColor,
                  backgroundColor: themeForm.hover.backgroundColor,
                  borderColor: themeForm.hover.borderColor,
                  borderThickness: themeForm.hover.borderThickness,
                  opacity: themeForm.hover.opacity
                }
              }
            : {}),
          ...(themeForm.focusEnabled
            ? {
                focus: {
                  textColor: themeForm.focus.textColor,
                  backgroundColor: themeForm.focus.backgroundColor,
                  borderColor: themeForm.focus.borderColor,
                  borderThickness: themeForm.focus.borderThickness,
                  opacity: themeForm.focus.opacity
                }
              }
            : {})
        }
      },
      stem: {
        shape: themeForm.stemShape,
        states: {
          default: {
            color: themeForm.stemColor,
            opacity: themeForm.stemOpacity
          },
          ...(themeForm.stemHoverEnabled
            ? {
                hover: {
                  color: themeForm.stemHover.color,
                  opacity: themeForm.stemHover.opacity
                }
              }
            : {}),
          ...(themeForm.stemFocusEnabled
            ? {
                focus: {
                  color: themeForm.stemFocus.color,
                  opacity: themeForm.stemFocus.opacity
                }
              }
            : {})
        }
      }
    }
  }
  projectStore.setTheme(overrides)
  handle.value?.setTheme(overrides)
  void persistCurrentProject()
}

function applyMapSize() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const width = Math.max(1, Math.floor(workspaceForm.width))
  const height = Math.max(1, Math.floor(workspaceForm.height))
  const nextLegend = { ...legend, size: [width, height] as [number, number] }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    datasetRef.value.legend = nextLegend
    requestViewerRemount()
  }
  void persistCurrentProject()
}

function applySeaLevel() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const seaLevel = clampNumber(Number(workspaceForm.seaLevel), -1, 1)
  workspaceForm.seaLevel = seaLevel
  const nextLegend = { ...legend, sea_level: seaLevel }
  projectStore.setLegend(nextLegend)
  layerBrowserStore.setLegend(nextLegend)
  if (datasetRef.value) {
    datasetRef.value.legend = nextLegend
    handle.value?.setSeaLevel(seaLevel)
  }
  void persistCurrentProject()
}

function cloneValue<T>(value: T): T {
  return value ? (JSON.parse(JSON.stringify(value)) as T) : value
}

async function persistCurrentProject(options: { base64?: string; label?: string } = {}) {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  const next = await persistProjectSnapshot(snapshot, options)
  if (next) {
    persistedProject.value = next
    projectStore.markPersisted()
  }
}

function archiveUrl() {
  return new URL('../maps/wynnal-terrain.wyn', window.location.href).toString()
}

function disposeViewer() {
  handle.value?.destroy()
  handle.value = null
}

function cleanupDataset() {
  datasetRef.value?.cleanup?.()
  datasetRef.value = null
}

function requestViewerRemount() {
  if (!datasetRef.value) return
  if (viewerRemountHandle !== null) {
    window.clearTimeout(viewerRemountHandle)
  }
  viewerRemountHandle = window.setTimeout(() => {
    viewerRemountHandle = null
    void mountViewer()
  }, 80)
}

async function mountViewer() {
  const viewerElement = viewerShell.value?.getViewerElement()
  if (!viewerElement || !datasetRef.value || !layerState.value) return
  disposeViewer()
  handle.value = await initTerrainViewer(viewerElement, datasetRef.value, {
    layers: layerState.value,
    locations: getViewerLocations(),
    interactive: interactive.value,
    theme: projectSnapshot.value.theme,
    onLocationPick: (payload) => {
        const snapped = {
          x: snapLocationValue(clampNumber(payload.pixel.x, 0, workspaceForm.width), workspaceForm.width),
          y: snapLocationValue(clampNumber(payload.pixel.y, 0, workspaceForm.height), workspaceForm.height)
        }
        if (pendingLocationId.value === NEW_LOCATION_PLACEHOLDER && pendingLocationDraft.value) {
          const draft = ensureLocationId({ ...pendingLocationDraft.value, pixel: snapped })
          pendingLocationDraft.value = null
          pendingLocationId.value = null
          interactive.value = false
          handle.value?.setInteractiveMode(false)
          locationsList.value = [...locationsList.value, draft]
          commitLocations()
          setActiveLocation(draft.id!)
          updateStatus(`Added ${draft.name ?? draft.id} at (${draft.pixel.x}, ${draft.pixel.y}).`)
          return
        }
        if (pendingLocationId.value) {
          const target = locationsList.value.find((location) => location.id === pendingLocationId.value)
          if (target) {
            target.pixel = snapped
            pendingLocationId.value = null
            interactive.value = false
            handle.value?.setInteractiveMode(false)
            commitLocations()
            setActiveLocation(target.id!)
            updateStatus(`Placed ${target.name ?? target.id} at (${target.pixel.x}, ${target.pixel.y}).`)
            return
          }
        }
        updateStatus(`Picked pixel (${snapped.x}, ${snapped.y})`)
    },
    onLocationClick: (locationId) => setActiveLocation(locationId, { fromViewer: true })
  })
}

type LoadArchiveOptions = {
  persist?: boolean
  base64?: string
}

async function loadArchiveFromBytes(buffer: ArrayBuffer, label: string, options: LoadArchiveOptions = {}) {
  const loadingLabel = `Loading ${label}…`
  updateStatus(loadingLabel)
  setOverlayLoading({ label: loadingLabel, loadedBytes: 0 })
  disposeViewer()
  cleanupDataset()
  clearAssetOverrides()
  missingIconWarnings.clear()
  pendingLocationDraft.value = null
  pendingLocationId.value = null
  try {
    const archive = await loadWynArchiveFromArrayBuffer(buffer, { includeFiles: true })
    const archiveLabel = archive.metadata?.label ?? label
    datasetRef.value = wrapDatasetWithOverrides(archive.dataset)
    baseThemeRef.value = cloneValue(archive.dataset.theme)
    layerBrowserStore.setLegend(archive.legend)
    projectStore.loadFromArchive({
      legend: archive.legend,
      locations: archive.locations,
      theme: archive.dataset.theme,
      files: archive.files,
      metadata: {
        ...archive.metadata,
        label: archiveLabel
      }
    })

    await mountViewer()
    updateStatus(`${archiveLabel} loaded.`)
    if (options.persist ?? true) {
      const base64 = options.base64 ?? arrayBufferToBase64(buffer)
      await persistCurrentProject({ label: archiveLabel, base64 })
    }
  } catch (err) {
    console.error(err)
    updateStatus(`Failed to load ${label}.`)
  } finally {
    setOverlayLoading(null)
    refreshIconPreviewCache()
  }
}

async function loadSample() {
  try {
    updateStatus('Downloading sample archive…')
    const response = await fetch(archiveUrl())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    await loadArchiveFromBytes(buffer, 'sample archive')
  } catch (err) {
    console.error(err)
    updateStatus('Failed to download sample archive.')
  }
}

async function loadArchiveFromFile(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    await loadArchiveFromBytes(buffer, file.name)
  } catch (err) {
    console.error(err)
    updateStatus(`Failed to load ${file.name}.`)
  }
}

function closeActiveArchive() {
  disposeViewer()
  cleanupDataset()
  layerBrowserStore.setLegend(undefined)
  projectStore.reset()
  layerState.value = layerBrowserStore.getLayerToggles()
  locationsList.value = []
  selectedLocationId.value = null
  pendingLocationId.value = null
  confirmState.value = null
  iconPickerTarget.value = null
  locationsDragActive.value = false
  handle.value = null
  baseThemeRef.value = undefined
  activeDockPanel.value = 'workspace'
  interactive.value = false
  locationPickerOpen.value = false
  pendingLocationDraft.value = null
  pendingLocationId.value = null
  clearAssetOverrides()
  missingIconWarnings.clear()
  cancelThemeUpdate()
  refreshIconPreviewCache()
  updateStatus('Viewer cleared. Load a map to continue.')
  persistedProject.value = null
  setAutoRestoreEnabled(false)
}

function promptCloseArchive() {
  if (!hasActiveArchive.value) return
  requestConfirm('Unload the current map? Unsaved changes may be lost.', () => closeActiveArchive())
}

function createScratchLegend(): TerrainLegend {
  const width = Math.max(1, Math.floor(workspaceForm.width) || 512)
  const height = Math.max(1, Math.floor(workspaceForm.height) || 512)
  const seaLevel = clampNumber(Number.isFinite(workspaceForm.seaLevel) ? Number(workspaceForm.seaLevel) : 0, -1, 1)
  return {
    size: [width, height] as [number, number],
    heightmap: 'heightmap.png',
    topology: 'heightmap.png',
    sea_level: seaLevel,
    biomes: {},
    overlays: {}
  }
}

function startNewMap() {
  closeActiveArchive()
  const scratchLegend = createScratchLegend()
  projectStore.setLegend(scratchLegend)
  layerBrowserStore.setLegend(scratchLegend)
  workspaceForm.width = scratchLegend.size[0]
  workspaceForm.height = scratchLegend.size[1]
  workspaceForm.seaLevel = scratchLegend.sea_level ?? 0
  setActivePanel('workspace')
  isDockCollapsed.value = false
  updateStatus('New project ready. Import layers to begin editing.')
  persistedProject.value = null
  clearPersistedProject()
  setAutoRestoreEnabled(false)
}

function addLocation() {
  const legend = projectSnapshot.value.legend
  if (!legend) return
  const draft: TerrainLocation = ensureLocationId({
    id: '',
    name: `New location ${locationsList.value.length + 1}`,
    pixel: { x: 0, y: 0 },
    showBorder: true
  })
  pendingLocationDraft.value = draft
  pendingLocationId.value = NEW_LOCATION_PLACEHOLDER
  selectedLocationId.value = null
  interactive.value = true
  handle.value?.setInteractiveMode(true)
  setActivePanel('locations')
  isDockCollapsed.value = false
  locationPickerOpen.value = false
  updateStatus('Click anywhere on the map to place the new location.')
}

function confirmRemoveLocation(location: TerrainLocation) {
  requestConfirm(`Remove location "${location.name ?? 'this location'}"?`, () => {
    locationsList.value = locationsList.value.filter((entry) => entry.id !== location.id)
    commitLocations()
    if (selectedLocationId.value === location.id) {
      setActiveLocation(locationsList.value[0]?.id ?? null)
    }
    if (pendingLocationId.value === location.id) {
      pendingLocationId.value = null
      interactive.value = false
      handle.value?.setInteractiveMode(false)
    }
  })
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportArchive() {
  const snapshot = projectStore.getSnapshot()
  if (!snapshot.legend) return
  try {
    updateStatus('Building archive…')
    const blob = await buildWynArchive(snapshot)
    const label = snapshot.metadata.label ?? 'terrain'
    const filename = label.endsWith('.wyn') ? label : `${label}.wyn`
    downloadBlob(filename, blob)
    updateStatus('Archive exported.')
  } catch (err) {
    console.error(err)
    updateStatus('Failed to export archive.')
  }
}

function toggleLayer(id: string) {
  layerBrowserStore.toggleVisibility(id)
}

function setAllLayers(kind: 'biome' | 'overlay', visible: boolean) {
  layerBrowserStore.setAll(kind, visible)
}

function rgb(color: [number, number, number]) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
}

function toggleInteraction() {
  interactive.value = !interactive.value
  handle.value?.setInteractiveMode(interactive.value)
}

async function toggleEditorFullscreen() {
  const root = editorRoot.value
  if (!root) return
  try {
    if (!document.fullscreenElement) {
      await root.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.warn('Failed to toggle fullscreen', err)
  }
}

async function restorePersistedProject(autoTrigger: boolean) {
  const saved = readPersistedProject()
  if (!saved) return
  persistedProject.value = saved
  const buffer = base64ToArrayBuffer(saved.archiveBase64)
  await loadArchiveFromBytes(buffer, saved.label, {
    persist: false,
    base64: saved.archiveBase64
  })
  if (!autoTrigger) {
    setAutoRestoreEnabled(true)
  }
  updateStatus(`${saved.label} restored from local storage.`, 4500)
}

function toggleDock() {
  isDockCollapsed.value = !isDockCollapsed.value
}

function setActivePanel(panel: DockPanel) {
  activeDockPanel.value = panel
}

function setActiveLocation(id: string | null, options: { fromViewer?: boolean } = {}) {
  selectedLocationId.value = id
  if (id && options.fromViewer && localSettings.openLocationsOnSelect) {
    setActivePanel('locations')
    isDockCollapsed.value = false
  }
}

function ensureActiveLocationSelection() {
  if (!locationsList.value.length) {
    selectedLocationId.value = null
    return
  }
  const ensured = locationsList.value.map((location) => ensureLocationId(location))
  if (!selectedLocationId.value || !ensured.some((location) => location.id === selectedLocationId.value)) {
    selectedLocationId.value = ensured[0].id ?? null
  }
}

function startPlacement(location: TerrainLocation) {
  if (!handle.value) return
  pendingLocationDraft.value = null
  const id = ensureLocationId(location).id!
  selectedLocationId.value = id
  pendingLocationId.value = id
  interactive.value = true
  handle.value.setInteractiveMode(true)
  updateStatus(`Click anywhere on the map to place ${location.name ?? 'this location'}.`)
}

function focusLocationInViewer(id: string) {
  if (!handle.value) return
  const target = locationsList.value.find((location) => ensureLocationId(location).id === id)
  if (!target) return
  handle.value.updateLocations(getViewerLocations(), id)
  const pixel =
    target.pixel ?? {
      x: Math.round(workspaceForm.width / 2),
      y: Math.round(workspaceForm.height / 2)
    }
  const view = localSettings.cameraTracking ? target.view : undefined
  handle.value.navigateTo({ pixel, locationId: id, view })
}

function getFallbackViewState(): LocationViewState {
  return handle.value?.getViewState() ?? { distance: 1, polar: Math.PI / 3, azimuth: 0 }
}

function ensureLocationView(location: TerrainLocation): LocationViewState {
  if (!location.view) {
    location.view = { ...getFallbackViewState() }
  }
  return location.view
}

function updateActiveLocationViewField(key: keyof LocationViewState, rawValue: string | number) {
  const location = activeLocation.value
  if (!location) return
  if (rawValue === '' || rawValue === null) {
    location.view = undefined
    commitLocations()
    return
  }
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return
  const view = ensureLocationView(location)
  view[key] = parsed
  commitLocations()
}

function captureCameraViewForActiveLocation() {
  if (!handle.value || !activeLocation.value) return
  activeLocation.value.view = { ...handle.value.getViewState() }
  commitLocations()
  updateStatus(
    `Saved camera view for ${activeLocation.value.name ?? activeLocation.value.id}.`,
    1500
  )
}

function clearActiveLocationView() {
  if (!activeLocation.value || !activeLocation.value.view) return
  activeLocation.value.view = undefined
  commitLocations()
}

function openIconPicker(location: TerrainLocation) {
  setAssetDialogFilter('icon')
  iconPickerTarget.value = ensureLocationId(location).id!
}

function closeIconPicker() {
  iconPickerTarget.value = null
  setAssetDialogFilter('')
  pendingAssetReplacement.value = null
}

function openLocationPicker() {
  if (!locationsList.value.length) return
  locationPickerOpen.value = true
}

function closeLocationPicker() {
  locationPickerOpen.value = false
}

function handleLocationSelect(id: string) {
  setActiveLocation(id)
  closeLocationPicker()
}

function selectIconFromLibrary(path: string) {
  if (!iconPickerTarget.value) return
  const target = locationsList.value.find(
    (entry) => ensureLocationId(entry).id === iconPickerTarget.value
  )
  if (!target) return
  target.icon = path
  commitLocations()
  closeIconPicker()
}

function beginAssetReplacement(asset: TerrainProjectFileEntry) {
  triggerLibraryUpload({
    replacePath: asset.path,
    originalName: asset.sourceFileName ?? asset.path
  })
}

function triggerLibraryUpload(options?: { replacePath?: string; originalName?: string }) {
  if (options?.replacePath) {
    pendingAssetReplacement.value = {
      path: options.replacePath,
      originalName: options.originalName
    }
  } else {
    pendingAssetReplacement.value = null
  }
  iconLibraryInputRef.value?.click()
}

async function handleLibraryUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    input.value = ''
    return
  }
  const replacementTarget = pendingAssetReplacement.value
  pendingAssetReplacement.value = null
  const resetInput = () => {
    input.value = ''
  }
  if (replacementTarget) {
    const performReplacement = async () => {
      await replaceAssetWithFileHelper(replacementTarget.path, file)
      resetInput()
    }
    const existingLabel = replacementTarget.originalName ?? replacementTarget.path
    const existingName = normalizeAssetFileName(existingLabel)
    const incomingName = normalizeAssetFileName(file.name)
    if (existingName !== incomingName) {
      requestConfirm(`Replace ${existingLabel} with ${file.name}?`, () => {
        void performReplacement()
      })
      resetInput()
      return
    }
    await performReplacement()
    return
  }
  const defaultPath = buildIconPath(file.name)
  const importAsset = async () => {
    await importIconAssetHelper(file, iconPickerTarget.value ?? undefined, defaultPath)
    resetInput()
  }
  const existingAsset = projectAssets.value.find((asset) => asset.path === defaultPath)
  if (existingAsset) {
    const existingLabel = existingAsset.sourceFileName ?? existingAsset.path
    requestConfirm(`Uploading ${file.name} will replace ${existingLabel}. Continue?`, () => {
      void importAsset()
    })
    resetInput()
    return
  }
  await importAsset()
}

async function importLocationIcon(location: TerrainLocation, file: File) {
  await importIconAssetHelper(file, ensureLocationId(location).id!)
}

function commitLocations() {
  const cloned = locationsList.value.map((location) => {
    const copy = ensureLocationId({ ...location })
    if (copy.showBorder === undefined) copy.showBorder = true
    return copy
  })
  locationsList.value = cloned
  projectStore.setLocations(cloned)
  handle.value?.updateLocations(getViewerLocations(cloned), selectedLocationId.value ?? undefined)
  ensureActiveLocationSelection()
  void persistCurrentProject()
}

function clampLocationPixel(location: TerrainLocation) {
  const width = workspaceForm.width
  const height = workspaceForm.height
  location.pixel.x = snapLocationValue(clampNumber(location.pixel.x ?? 0, 0, width), width)
  location.pixel.y = snapLocationValue(clampNumber(location.pixel.y ?? 0, 0, height), height)
  commitLocations()
}

function clearLocationIcon(location: TerrainLocation) {
  location.icon = undefined
  commitLocations()
}

function onLocationsDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types?.includes('Files')) return
  swallowDragEvent(event)
  locationsDragActive.value = true
}

function onLocationsDragLeave(event: DragEvent) {
  swallowDragEvent(event)
  const target = event.relatedTarget as HTMLElement | null
  if (!target || !event.currentTarget) {
    locationsDragActive.value = false
    return
  }
  const current = event.currentTarget as HTMLElement
  if (!current.contains(target)) {
    locationsDragActive.value = false
  }
}

async function onLocationsDrop(event: DragEvent) {
  swallowDragEvent(event)
  locationsDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !activeLocation.value) return
  await importLocationIcon(activeLocation.value, file)
}

function swallowDragEvent(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()
}

function handleWindowDragEvent(event: DragEvent) {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.closest('.panel-dock') ||
      target.closest('.asset-dialog') ||
      target.closest('.confirm-dialog'))
  ) {
    return
  }
  swallowDragEvent(event)
}

async function importIconAsset(file: File, targetLocationId?: string, overridePath?: string) {
  await importIconAsset(file, targetLocationId, overridePath)
}

async function replaceAssetWithFile(path: string, file: File) {
  await replaceAssetWithFile(path, file)
}

function removeAsset(path: string) {
  requestConfirm(`Remove ${path}?`, () => {
    removeAssetFromStore(path)
    if (iconPickerTarget.value) {
      iconPickerTarget.value = null
    }
  })
}

function getViewerLocations(list = locationsList.value) {
  return list.map((location) => ({
    ...location,
    icon: resolveAssetReference(location.icon)
  }))
}

function wrapDatasetWithOverrides(dataset: TerrainDataset): TerrainDataset {
  const baseResolve = dataset.resolveAssetUrl.bind(dataset)
  return {
    ...dataset,
    resolveAssetUrl: (path: string) => {
      if (assetOverrides.has(path)) {
        return assetOverrides.get(path)!
      }
      return baseResolve(path)
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('dragover', handleWindowDragEvent, true)
  window.addEventListener('drop', handleWindowDragEvent, true)
  loadLocalSettings()
  const saved = readPersistedProject()
  if (saved) {
    persistedProject.value = saved
    if (shouldAutoRestoreProject()) {
      void restorePersistedProject(true)
    }
  }
})

onBeforeUnmount(() => {
  disposeViewer()
  cleanupDataset()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('dragover', handleWindowDragEvent, true)
  window.removeEventListener('drop', handleWindowDragEvent, true)
  disposeAssetPreviewUrls()
  cancelThemeUpdate()
  if (viewerRemountHandle !== null) {
    window.clearTimeout(viewerRemountHandle)
    viewerRemountHandle = null
  }
  if (statusFadeHandle !== null) {
    window.clearTimeout(statusFadeHandle)
    statusFadeHandle = null
  }
})
</script>
