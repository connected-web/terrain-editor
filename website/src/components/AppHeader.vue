<template>
  <header class="row header">
    <div class="brand">
      <div class="editor-icon"></div>
      <h1>Terrain Editor</h1>
      <span class="version-tag">v{{ version }}</span>
    </div>
    <nav class="primary-nav">
      <RouterLink to="/">Home</RouterLink>
      <a href="#demos">Demos</a>
      <a href="#roadmap">Roadmap</a>
      <RouterLink to="/editor">Editor</RouterLink>
      <a href="https://github.com/connected-web/terrain-editor" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </nav>
  </header>
</template>

<script lang="ts" setup>
import { RouterLink } from 'vue-router'
import { version as appVersion } from '../../package.json'

const version = String(appVersion).split('.').slice(0, 2).join('.')
</script>
