<template>
  <section class="hero">
    <p class="muted">Connected Web experiments</p>
    <h1>Build, edit, and explore Wyn terrain files directly in the browser.</h1>
    <p class="muted">
      A suite of Three.js powered tools and demos for inspecting rich terrain datasets, editing
      metadata, and validating Wyn archive workflows.
    </p>
    <div class="cta-row">
      <a
        class="button primary"
        href="https://connected-web.github.io/terrain-editor/viewer-js/"
        target="_blank"
        rel="noreferrer"
      >
        Launch Viewer Demo
      </a>
      <RouterLink class="button secondary" to="/editor">Visit Editor Preview</RouterLink>
      <a
        class="button secondary"
        href="https://github.com/connected-web/terrain-editor"
        target="_blank"
        rel="noreferrer"
      >
        GitHub Project
      </a>
    </div>
  </section>

  <section class="section-card" id="demos">
    <h2>Demos & Test Harnesses</h2>
    <p class="muted">Each demo validates reusable packages in different environments.</p>
    <div class="card-grid">
      <article v-for="demo in demos" :key="demo.title" class="info-card">
        <div class="status-pill" :class="demo.available ? 'done' : 'todo'">
          <span>{{ demo.available ? 'Available' : 'Coming soon' }}</span>
        </div>
        <h3>{{ demo.title }}</h3>
        <p class="muted">{{ demo.description }}</p>
        <a
          v-if="demo.url"
          class="button secondary"
          :href="demo.url"
          target="_blank"
          rel="noreferrer"
        >
          Open Demo
        </a>
      </article>
    </div>
  </section>

  <section class="section-card" id="roadmap">
    <h2>Roadmap Snapshot</h2>
    <div class="card-grid">
      <article class="info-card">
        <h3>Viewer</h3>
        <ul class="roadmap-list">
          <li v-for="item in viewerRoadmap" :key="item.label" class="roadmap-item">
            <span>{{ item.label }}</span>
            <span class="status-pill" :class="item.done ? 'done' : 'todo'">
              {{ item.done ? 'Done' : 'Next' }}
            </span>
          </li>
        </ul>
      </article>
      <article class="info-card">
        <h3>Editor</h3>
        <ul class="roadmap-list">
          <li v-for="item in editorRoadmap" :key="item.label" class="roadmap-item">
            <span>{{ item.label }}</span>
            <span class="status-pill" :class="item.done ? 'done' : 'todo'">
              {{ item.done ? 'Done' : 'Next' }}
            </span>
          </li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section-card">
    <h2>Need the Editor?</h2>
    <p class="muted">
      The editor SPA will live at <RouterLink to="/editor">/editor</RouterLink>. Today it’s a stub,
      but it will grow into a fully featured Wyn authoring experience with metadata editing,
      location tools, and layer manipulation.
    </p>
    <RouterLink class="button primary" to="/editor">Preview the editor route</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

type RoadmapItem = { label: string; done?: boolean }
type DemoCard = { title: string; description: string; available: boolean; url?: string }

const demos: DemoCard[] = [
  {
    title: 'Viewer (Vanilla TS)',
    description: 'SSG-hosted harness that loads Wyn archives asynchronously with JSZip.',
    available: true,
    url: 'https://connected-web.github.io/terrain-editor/viewer-js/'
  },
  {
    title: 'Viewer (Vue 3)',
    description: 'Upcoming wrapper that embeds the shared viewer inside a Vue 3 SPA.',
    available: false
  },
  {
    title: 'Editor (Vue 3)',
    description: 'End-to-end Wyn construction experience with metadata + layer tools.',
    available: false
  }
]

const viewerRoadmap: RoadmapItem[] = [
  { label: 'Shared Three.js renderer', done: true },
  { label: 'Vanilla TS demo & loader', done: true },
  { label: 'Vue 3 wrapper demo' },
  { label: 'Location & layer UX polish' }
]

const editorRoadmap: RoadmapItem[] = [
  { label: 'Editor SPA skeleton', done: false },
  { label: 'Wyn import/export pipeline', done: false },
  { label: 'Layer + mask editing tools', done: false },
  { label: 'Height + location workflows', done: false }
]
</script>
