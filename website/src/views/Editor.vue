<template>
  <section class="section-card editor-layout">
    <div>
      <p class="muted">Editor preview</p>
      <h1>Wyn Editor is under construction.</h1>
      <p class="muted">
        This route will eventually host the Vue 3 SPA for composing terrains. For now you can browse
        the roadmap and follow GitHub updates as we build out importing, editing, and exporting
        workflows.
      </p>
      <div class="cta-row">
        <a
          class="button secondary"
          href="https://github.com/connected-web/terrain-editor"
          target="_blank"
          rel="noreferrer"
        >
          Track progress on GitHub
        </a>
        <RouterLink class="button primary" to="/">Back to home</RouterLink>
      </div>
    </div>

    <div class="info-card">
      <h3>Planned capabilities</h3>
      <ul class="roadmap-list">
        <li class="roadmap-item">Upload Wyn archives and preview layers</li>
        <li class="roadmap-item">Edit metadata, descriptions, and credits</li>
        <li class="roadmap-item">Manipulate biome masks and overlays</li>
        <li class="roadmap-item">Adjust height maps and pin locations</li>
        <li class="roadmap-item">Export fresh Wyn bundles directly in browser</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
