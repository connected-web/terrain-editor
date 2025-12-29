<template>
  <header class="row header">
    <div class="brand">
      <div class="editor-icon"></div>
      <h1>Terrain Editor</h1>
      <span class="version-tag">v{{ version }}</span>
    </div>
    <nav class="primary-nav">
      <a href="./">Home</a>
      <a href="#demos">Demos</a>
      <a href="#roadmap">Roadmap</a>
      <a href="#user-guide">User Guide</a>
      <a href="#wyn-file-format">Wyn File Format</a>
      <a href="https://github.com/connected-web/terrain-editor" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </nav>
  </header>
</template>

<script lang="ts" setup>
import { version as appVersion } from '../../package.json'

const version = String(appVersion).split('.').slice(0, 2).join('.')
</script>
