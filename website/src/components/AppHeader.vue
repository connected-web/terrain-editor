<template>
  <header class="row header">
    <div class="brand">
      <div class="editor-icon"></div>
      <h1>Terrain Editor v{{ version }}</h1>
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
const version = __APP_VERSION_FULL__
</script>
