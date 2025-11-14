<template>
  <div class="row header">
    <div class="editor-icon"></div>
    <h1>Terrain Editor</h1>
    <span class="spacer"></span>
    <div class="version">{{ version }}</div>
  </div>
</template>

<script lang="ts" setup>
import { version as appVersion } from '../../package.json'

const version = String(appVersion).split('.').slice(0, 2).join('.')
</script>