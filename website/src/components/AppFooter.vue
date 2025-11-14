<template>
  <footer class="row footer">
    <span>© {{ year }} Connected Web — Terrain Editor experiments.</span>
    <span class="spacer"></span>
    <nav class="footer-nav">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/editor">Editor</RouterLink>
      <a href="https://github.com/connected-web/terrain-editor" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </nav>
  </footer>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

const year = new Date().getFullYear()
</script>
