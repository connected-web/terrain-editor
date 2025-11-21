<template>
  <section class="hero">
    <p class="muted">Connected Web Experiments</p>
    <h1>Build, edit, and explore Wyn terrain files directly in the browser.</h1>
    <p class="muted">
      A collection of Three.js powered tools for building and navigating layered map topologies; sharable as <code>.wyn</code> archives.
    </p>
    <div class="cta-row">
      <a class="button primary" :href="viewerTsUrl" target="_blank" rel="noreferrer">
        Launch Viewer
      </a>
      <a class="button primary" :href="editorUrl" target="_blank" rel="noreferrer">
        Launch Editor
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
    <h2>Interactive Demos</h2>
    <p class="muted">The following demos showcase the terrain viewer package for its intended use cases.</p>
    <div class="card-grid">
      <article v-for="demo in demos" :key="demo.title" class="info-card">
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
        <div class="status-pill" :class="demo.available ? 'done' : 'todo'">
          <span>{{ demo.available ? 'Available' : 'Coming soon' }}</span>
        </div>
      </article>
    </div>
  </section>

  <section class="section-card" id="roadmap">
    <h2 class="row">
      <label class="spacer">Roadmap</label>
      <code>Nov 2025</code>
    </h2>
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
    <p class="muted spacer">
      See activity on the <a href="https://github.com/connected-web/terrain-editor" target="_blank" rel="noreferrer">GitHub project page</a> for the latest updates and upcoming features.
    </p>
  </section>

</template>

<script setup lang="ts">
type RoadmapItem = { label: string; done?: boolean }
type DemoCard = { title: string; description: string; available: boolean; url?: string }

const devUrls =
  typeof window !== 'undefined' && import.meta.env.DEV
    ? (() => {
        const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
        const protocol = window.location.protocol || 'http:'
        const hostname = isLoopback ? window.location.hostname : 'localhost'
        const base = (port: number, path: string) => `${protocol}//${hostname}:${port}${path}`
        return {
          viewerTs: base(4173, '/viewer-js/'),
          editor: base(4175, '/editor/')
        }
      })()
    : null

const viewerTsUrl = devUrls?.viewerTs ?? './viewer-js/'
const editorUrl = devUrls?.editor ?? './editor/'

const demos: DemoCard[] = [
  {
    title: 'Terrain Viewer',
    description: 'Browser based harness that loads Wyn archives asynchronously and decodes with JSZip.',
    available: true,
    url: viewerTsUrl
  },
  {
    title: 'Terrain Editor',
    description: 'Full terrain editor for creating and modifying metadata and locations in existing Wyn archives.',
    available: true,
    url: editorUrl
  }
]

const viewerRoadmap: RoadmapItem[] = [
  { label: 'Self-contained Three.js renderer', done: true },
  { label: 'TS based viewer and .wyn loader', done: true },
  { label: 'Popout and full screen modes', done: true },
  { label: 'Location and layer UX polish', done: true }
]

const editorRoadmap: RoadmapItem[] = [
  { label: 'Editor skeleton with basic viewer', done: true },
  { label: 'Wyn import/export pipeline', done: false },
  { label: 'Layer + mask editing tools', done: false },
  { label: 'Height + location workflows', done: false }
]
</script>
