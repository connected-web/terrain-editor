<template>
  <section class="panel-card panel-card--theme">
    <header class="panel-card__header panel-card__header--split">
      <div class="panel-card__header-main">
        <Icon icon="palette">Theme</Icon>
      </div>
      <button class="pill-button pill-button--ghost" @click="$emit('reset-theme')" :disabled="!hasActiveArchive">
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
          <p>Control font + padding used across label states.</p>
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
            @click="$emit('reset-sprite', 'hover')"
            :disabled="!themeForm.hoverEnabled"
          >
            Use default
          </button>
        </header>
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
            @click="$emit('reset-sprite', 'focus')"
            :disabled="!themeForm.focusEnabled"
          >
            Use default
          </button>
        </header>
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
          <div class="theme-form__section-actions">
            <button
              type="button"
              class="pill-button pill-button--ghost"
              @click="$emit('reset-stem', 'hover')"
              :disabled="!themeForm.stemHoverEnabled"
            >
              Reset hover
            </button>
            <button
              type="button"
              class="pill-button pill-button--ghost"
              @click="$emit('reset-stem', 'focus')"
              :disabled="!themeForm.stemFocusEnabled"
            >
              Reset focus
            </button>
          </div>
        </header>
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
      <p class="theme-form__hint">
        Theme changes debounce automatically so rapid color tweaks don’t stall the viewer.
      </p>
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
  fontFamily: string
  fontWeight: string
  maxFontSize: number
  minFontSize: number
  paddingX: number
  paddingY: number
  borderRadius: number
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
