<template>
  <section class="panel-card panel-card--theme">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="palette">Theme</Icon>
      </div>
    </header>
    <div class="theme-form">
      <section class="theme-form__section">
        <header>
          <h4>Labels</h4>
        </header>
        <label class="theme-form__field">
          <span>Text color</span>
          <input type="color" v-model="themeForm.textColor" @input="$emit('schedule-update')" />
        </label>
        <label class="theme-form__field">
          <span>Background</span>
          <input type="color" v-model="themeForm.backgroundColor" @input="$emit('schedule-update')" />
        </label>
        <label class="theme-form__field">
          <span>Border</span>
          <input type="color" v-model="themeForm.borderColor" @input="$emit('schedule-update')" />
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
              @input="$emit('schedule-update')"
            />
            <input
              type="number"
              min="0"
              max="4"
              step="0.25"
              v-model.number="themeForm.borderThickness"
              @change="$emit('schedule-update')"
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
              @input="$emit('schedule-update')"
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              v-model.number="themeForm.opacity"
              @change="$emit('schedule-update')"
            />
          </label>
        </div>
      </section>
      <section class="theme-form__section">
        <header>
          <h4>Typography & spacing</h4>
        </header>
        <label class="theme-form__field">
          <span>Font family</span>
          <input type="text" v-model="themeForm.fontFamily" @change="$emit('schedule-update')" />
        </label>
        <div class="theme-form__split">
          <label class="theme-form__field">
            <span>Font weight</span>
            <input type="text" v-model="themeForm.fontWeight" @change="$emit('schedule-update')" />
          </label>
          <label class="theme-form__field">
            <span>Min font size</span>
            <input
              type="number"
              min="4"
              max="64"
              step="1"
              v-model.number="themeForm.minFontSize"
              @change="$emit('schedule-update')"
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
              @change="$emit('schedule-update')"
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
              @change="$emit('schedule-update')"
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
              @change="$emit('schedule-update')"
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
              @change="$emit('schedule-update')"
            />
          </label>
        </div>
      </section>
      <section class="theme-form__section">
        <header>
          <h4>Interactivity</h4>
        </header>
        <div class="theme-form__split">
          <label class="theme-form__field">
            <span>Icon scale</span>
            <input
              type="number"
              min="0.1"
              max="3"
              step="0.05"
              v-model.number="themeForm.iconScale"
              @change="$emit('schedule-update')"
            />
          </label>
          <label class="theme-form__field">
            <span>Fade range (% of shortest map side)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              v-model.number="themeForm.fadeRange"
              @input="$emit('schedule-update')"
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              v-model.number="themeForm.fadeRange"
              @change="$emit('schedule-update')"
            />
          </label>
          <label class="theme-form__field">
            <span>Label offset (% of stem height)</span>
            <input
              type="number"
              min="-1"
              max="1"
              step="0.01"
              v-model.number="themeForm.labelOffset"
              @change="$emit('schedule-update')"
            />
          </label>
        </div>
      </section>
      <section class="theme-form__section">
        <div class="row left">
          <h4>Hover state</h4>
          <span class="spacer"></span>
          <button
            type="button"
            class="pill-button pill-button--ghost"
            @click="$emit('reset-sprite', 'hover')"
            :disabled="!themeForm.hoverEnabled"
          >
            <Icon icon="eraser">Use defaults</Icon>
          </button>
        </div>
        <div class="theme-form__state-grid">
          <label class="theme-form__field">
            <span>Text</span>
            <input type="color" v-model="themeForm.hover.textColor" @input="$emit('sprite-input', 'hover')" />
          </label>
          <label class="theme-form__field">
            <span>Background</span>
            <input type="color" v-model="themeForm.hover.backgroundColor" @input="$emit('sprite-input', 'hover')" />
          </label>
          <label class="theme-form__field">
            <span>Border</span>
            <input type="color" v-model="themeForm.hover.borderColor" @input="$emit('sprite-input', 'hover')" />
          </label>
          <label class="theme-form__field">
            <span>Thickness</span>
            <input
              type="number"
              min="0"
              max="4"
              step="0.25"
              v-model.number="themeForm.hover.borderThickness"
              @input="$emit('sprite-input', 'hover')"
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
              @input="$emit('sprite-input', 'hover')"
            />
          </label>
        </div>
      </section>
      <section class="theme-form__section">
        <div class="row">
          <h4>Focus state</h4>
          <span class="spacer"></span>
          <button
            type="button"
            class="pill-button pill-button--ghost"
            @click="$emit('reset-sprite', 'focus')"
            :disabled="!themeForm.focusEnabled"
          >
            <Icon icon="eraser">Use defaults</Icon>
          </button>
        </div>
        <div class="theme-form__state-grid">
          <label class="theme-form__field">
            <span>Text</span>
            <input type="color" v-model="themeForm.focus.textColor" @input="$emit('sprite-input', 'focus')" />
          </label>
          <label class="theme-form__field">
            <span>Background</span>
            <input type="color" v-model="themeForm.focus.backgroundColor" @input="$emit('sprite-input', 'focus')" />
          </label>
          <label class="theme-form__field">
            <span>Border</span>
            <input type="color" v-model="themeForm.focus.borderColor" @input="$emit('sprite-input', 'focus')" />
          </label>
          <label class="theme-form__field">
            <span>Thickness</span>
            <input
              type="number"
              min="0"
              max="4"
              step="0.25"
              v-model.number="themeForm.focus.borderThickness"
              @input="$emit('sprite-input', 'focus')"
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
              @input="$emit('sprite-input', 'focus')"
            />
          </label>
        </div>
      </section>
      <section class="theme-form__section">
        <header class="theme-form__section-header">
          <div class="theme-form__section-text">
            <h4>Stems</h4>
            <p>Adjust stem shape and per-state colors.</p>
          </div>
        </header>
        <div class="row center">
          <button
            type="button"
            class="pill-button pill-button--ghost"
            @click="$emit('reset-stem', 'hover')"
            :disabled="!themeForm.stemHoverEnabled"
          >
            <Icon icon="eraser">Reset hover</Icon>
          </button>
          <button
            type="button"
            class="pill-button pill-button--ghost"
            @click="$emit('reset-stem', 'focus')"
            :disabled="!themeForm.stemFocusEnabled"
          >
            <Icon icon="eraser">Reset focus</Icon>
          </button>
        </div>
        <label class="theme-form__field">
          <span>Shape</span>
          <select v-model="themeForm.stemShape" @change="$emit('schedule-update')">
            <option v-for="shape in stemShapeOptions" :key="shape" :value="shape">
              {{ shape }}
            </option>
          </select>
        </label>
        <div class="theme-form__split">
          <label class="theme-form__field">
            <span>Thickness (0-5; 1 = 0.01 map units)</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              v-model.number="themeForm.stemRadius"
              @change="$emit('schedule-update')"
            />
          </label>
          <label class="theme-form__field">
            <span>Height (map units)</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              v-model.number="themeForm.stemHeight"
              @change="$emit('schedule-update')"
            />
          </label>
          <label class="theme-form__field">
            <span>Color</span>
            <input type="color" v-model="themeForm.stemColor" @input="$emit('schedule-update')" />
          </label>
          <label class="theme-form__field">
            <span>Opacity</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              v-model.number="themeForm.stemOpacity"
              @input="$emit('schedule-update')"
            />
          </label>
        </div>
        <div class="theme-form__state-grid">
          <label class="theme-form__field">
            <span>Hover color</span>
            <input
              type="color"
              v-model="themeForm.stemHover.color"
              @input="$emit('stem-input', 'hover')"
            />
          </label>
          <label class="theme-form__field">
            <span>Hover opacity</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              v-model.number="themeForm.stemHover.opacity"
              @input="$emit('stem-input', 'hover')"
            />
          </label>
          <label class="theme-form__field">
            <span>Focus color</span>
            <input
              type="color"
              v-model="themeForm.stemFocus.color"
              @input="$emit('stem-input', 'focus')"
            />
          </label>
          <label class="theme-form__field">
            <span>Focus opacity</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              v-model.number="themeForm.stemFocus.opacity"
              @input="$emit('stem-input', 'focus')"
            />
          </label>
        </div>
      </section>
      <div class="theme-form__section">
        <h4>Danger</h4>
        <div class="row left">
          <button class="pill-button pill-button--ghost" @click="$emit('reset-theme')" :disabled="!hasActiveArchive">
            <Icon icon="eraser">Reset all styles</Icon>
          </button>
          <span class="spacer"></span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MarkerStemGeometryShape } from '@connected-web/terrain-editor'
import Icon from '../Icon.vue'

type ThemeForm = {
  textColor: string
  backgroundColor: string
  borderColor: string
  borderThickness: number
  opacity: number
  stemColor: string
  stemOpacity: number
  stemShape: MarkerStemGeometryShape
  stemRadius: number
  stemHeight: number
  fontFamily: string
  fontWeight: string
  maxFontSize: number
  minFontSize: number
  paddingX: number
  paddingY: number
  borderRadius: number
  labelOffset: number
  hoverEnabled: boolean
  focusEnabled: boolean
  hover: {
    textColor: string
    backgroundColor: string
    borderColor: string
    borderThickness: number
    opacity: number
  }
  focus: {
    textColor: string
    backgroundColor: string
    borderColor: string
    borderThickness: number
    opacity: number
  }
  stemHoverEnabled: boolean
  stemFocusEnabled: boolean
  stemHover: { color: string; opacity: number }
  stemFocus: { color: string; opacity: number }
}

defineProps<{
  themeForm: ThemeForm
  stemShapeOptions: MarkerStemGeometryShape[]
  hasActiveArchive: boolean
}>()

defineEmits<{
  'schedule-update': []
  'sprite-input': ['hover' | 'focus']
  'reset-sprite': ['hover' | 'focus']
  'stem-input': ['hover' | 'focus']
  'reset-stem': ['hover' | 'focus']
  'reset-theme': []
}>()
</script>

<style scoped>

.theme-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.theme-form__section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: left;
}

.theme-form__section header {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.theme-form__section h4 {
  margin: 0;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(242, 237, 224, 0.8);
}

.theme-form__section p {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.theme-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgba(242, 237, 224, 0.75);
}

.theme-form__field input[type='color'] {
  width: 100%;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 0;
}

.theme-form__field input[type='number'] {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.35);
  color: inherit;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}

.theme-form__field select {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.35);
  color: inherit;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}

.theme-form__field input[type='range'] {
  width: 100%;
}

.theme-form__split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.theme-form__state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.theme-form__toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.theme-form__hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
  text-align: center;
}

.theme-form__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.theme-form__section-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.theme-form__state-hint {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
}

.theme-form__state-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.theme-form__state-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.theme-form__state-header h5 {
  margin: 0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(242, 237, 224, 0.75);
}

</style>
