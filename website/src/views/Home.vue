<template>
  <section class="hero">
    <div class="hero__content">
      <p class="muted">Connected Web Technology Forge</p>
      <h1>Craft and tune Wyn terrain maps in a full 3D editor — right in the browser.</h1>
      <p class="muted">
        Three.js powered tooling for sculpting, masking, and touring layered map topologies, packaged as portable <code>.wyn</code> archives.
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
    </div>
    <div class="hero__media">
      <img
        src="/images/layer-editor-forest.png"
        alt="Layer editor forest mask preview"
        loading="lazy"
      />
    </div>
  </section>

  <section class="section-card" id="demos">
    <h2>Interactive Demos</h2>
    <p class="muted">Pick a map to open directly in the viewer or editor.</p>
    <div class="card-grid">
      <article v-for="map in demoMaps" :key="map.id" class="info-card">
        <div class="info-card__media">
          <img
            v-if="map.thumbnail"
            :src="map.thumbnail"
            :alt="`${map.title} preview`"
            loading="lazy"
          />
          <div v-else class="info-card__media-placeholder">No thumbnail</div>
        </div>
        <h3>{{ map.title }}</h3>
        <p class="muted spacer">{{ map.description }}</p>
        <div class="info-card__actions">
          <a
            v-if="map.status === 'available'"
            class="button secondary"
            :href="buildViewerUrl(map.filename)"
            target="_blank"
            rel="noreferrer"
          >
            Open in Viewer
          </a>
          <span v-else class="button secondary button--disabled">Open in Viewer</span>
          <a
            v-if="map.status === 'available'"
            class="button secondary"
            :href="buildEditorUrl(map.filename)"
            target="_blank"
            rel="noreferrer"
          >
            Open in Editor
          </a>
          <span v-else class="button secondary button--disabled">Open in Editor</span>
        </div>
        <div class="status-pill" :class="map.status === 'available' ? 'done' : 'todo'">
          <span>{{ map.status === 'available' ? 'Added' : 'Planned' }} · {{ map.date }}</span>
        </div>
      </article>
    </div>
  </section>

  <section class="section-card" id="roadmap">
    <h2 class="row">
      <label class="spacer">Roadmap</label>
    </h2>
    <div class="card-grid">
      <article class="info-card">
        <h3>Viewer</h3>
        <ul class="roadmap-list">
          <li v-for="item in viewerRoadmap" :key="item.label" class="roadmap-item">
            <span>{{ item.label }}</span>
            <span class="status-pill done">{{ item.date }}</span>
          </li>
        </ul>
      </article>
      <article class="info-card">
        <h3>Editor</h3>
        <ul class="roadmap-list">
          <li v-for="item in editorRoadmap" :key="item.label" class="roadmap-item">
            <span>{{ item.label }}</span>
            <span class="status-pill done">{{ item.date }}</span>
          </li>
        </ul>
      </article>
    </div>
    <p class="muted spacer">
      See activity on the <a href="https://github.com/connected-web/terrain-editor" target="_blank" rel="noreferrer">GitHub project page</a> for the latest updates and upcoming features.
      The detailed roadmap lives in <a href="https://github.com/connected-web/terrain-editor/blob/main/DEVELOPMENT-ROADMAP.md" target="_blank" rel="noreferrer">DEVELOPMENT-ROADMAP.md</a>.
    </p>
  </section>

</template>

<script setup lang="ts">
import { ref } from 'vue'
type RoadmapItem = { label: string; date: string }
type DemoMap = {
  id: string
  title: string
  description: string
  filename: string
  status: 'available' | 'planned'
  date: string
  thumbnail?: string | null
}

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

const demoMaps = ref<DemoMap[]>([])

const buildViewerUrl = (filename: string) => `${viewerTsUrl}?map=${encodeURIComponent(filename)}`
const buildEditorUrl = (filename: string) => `${editorUrl}?map=${encodeURIComponent(filename)}`

async function loadDemoMaps() {
  try {
    const response = await fetch('./maps/registry.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { maps: DemoMap[] }
    demoMaps.value = data.maps ?? []
  } catch (err) {
    console.error('Failed to load demo map registry', err)
  }
}

if (typeof window !== 'undefined') {
  void loadDemoMaps()
}

const viewerRoadmap: RoadmapItem[] = [
  { label: 'Self-contained Three.js renderer', date: 'Nov 2025' },
  { label: 'TS based viewer and .wyn loader', date: 'Nov 2025' },
  { label: 'Popout and full screen modes', date: 'Nov 2025' },
  { label: 'Location and layer UX polish', date: 'Nov 2025' }
]

const editorRoadmap: RoadmapItem[] = [
  { label: 'Editor skeleton with basic viewer', date: 'Nov 2025' },
  { label: 'Wyn import/export pipeline', date: 'Dec 2025' },
  { label: 'Layer + mask editing tools', date: 'Dec 2025' },
  { label: 'Height + location workflows', date: 'Dec 2025' }
]
</script>
