<template>
  <section class="hero">
    <p class="muted">Connected Web experiments</p>
    <h1>Build, edit, and explore Wyn terrain files directly in the browser.</h1>
    <p class="muted">
      A suite of Three.js powered tools and demos for inspecting rich terrain datasets, editing
      metadata, and validating Wyn archive workflows.
    </p>
    <div class="cta-row">
      <a class="button primary" :href="viewerTsUrl" target="_blank" rel="noreferrer">
        Launch Viewer (TS)
      </a>
      <a class="button primary" :href="viewerVueUrl" target="_blank" rel="noreferrer">
        Launch Viewer (Vue)
      </a>
      <a class="button secondary" :href="editorUrl" target="_blank" rel="noreferrer">
        Open Editor
      </a>
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
        <p class="muted spacer">{{ demo.description }}</p>
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

</template>

<script setup lang="ts">
type RoadmapItem = { label: string; done?: boolean }
type DemoCard = { title: string; description: string; available: boolean; url?: string }

const devUrls =
  typeof window !== 'undefined' && import.meta.env.DEV
    ? (() => {
        const protocol = window.location.protocol || 'http:'
        const hostname = window.location.hostname || 'localhost'
        const base = (port: number, path: string) => `${protocol}//${hostname}:${port}${path}`
        return {
          viewerTs: base(4173, '/viewer-js/'),
          viewerVue: base(4174, '/viewer-vue3/'),
          editor: base(4175, '/editor/')
        }
      })()
    : null

const viewerTsUrl = devUrls?.viewerTs ?? './viewer-js/'
const viewerVueUrl = devUrls?.viewerVue ?? './viewer-vue3/'
const editorUrl = devUrls?.editor ?? './editor/'

const demos: DemoCard[] = [
  {
    title: 'Viewer (Vanilla TS)',
    description: 'SSG-hosted harness that loads Wyn archives asynchronously with JSZip.',
    available: true,
    url: viewerTsUrl
  },
  {
    title: 'Viewer (Vue 3)',
    description: 'Vue 3 wrapper that binds viewer events to reactive UI controls.',
    available: true,
    url: viewerVueUrl
  },
  {
    title: 'Editor (Vue 3)',
    description: 'Early editor playground for modifying metadata and locations.',
    available: true,
    url: editorUrl
  }
]

const viewerRoadmap: RoadmapItem[] = [
  { label: 'Shared Three.js renderer', done: true },
  { label: 'Vanilla TS demo & loader', done: true },
  { label: 'Vue 3 wrapper demo', done: true },
  { label: 'Location & layer UX polish', done: true }
]

const editorRoadmap: RoadmapItem[] = [
  { label: 'Editor SPA skeleton', done: true },
  { label: 'Wyn import/export pipeline', done: false },
  { label: 'Layer + mask editing tools', done: false },
  { label: 'Height + location workflows', done: false }
]
</script>
