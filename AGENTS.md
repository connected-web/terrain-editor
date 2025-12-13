# Terrain Editor — Product Specification (Roadmap)

## Overview

A web-based 3D terrain editing environment built on the shared `@connected-web/terrain-editor` package.

### Host Responsibilities

* [x] Expose a single viewer container
* [x] Connect the shared overlay helper
* [x] Load `.wyn` archives through loader utilities

### Editor Shell Components

* [x] 3D viewer
* [x] Multi-panel dock + toolbar
* [x] Asset dialogs
* [x] Project persistence + storage helpers

---

# Feature Roadmap

## ✓ Completed Features

### Core Editor Facilities

* [x] Panel dock + toolbar contract with single-active-panel behavior
* [x] Workspace panel for metadata (title, author, size, sea level) with viewer remount
* [x] Persist active project into local storage
* [x] In-browser `.wyn` decompress/edit/repack pipeline (`buildWynArchive`, `projectStore`)

### Locations & Theme Tooling

* [x] Locations tool: list, inspector, drag/drop uploads, asset picker, pick-on-map
* [x] Theme editor: label + stem styling, hover/focus variants, reset-to-default

### Marker Rendering

* [x] Correct icon aspect ratio
* [x] Optional border honoring theme settings
* [x] Zoom-reactive stems
* [x] Placement waits for map click

### Mask & Layer Editing (Current Capabilities)

* [x] Mask editing persists and remounts correctly
* [x] Biome colour editing updates viewer without reload
* [x] Toolbar-integrated colour picker
* [x] Canvas zoom/pan
* [x] Brush cursor reflects size

### Export / Repack Pipeline

* [x] `buildWynArchive` (JSZip)
* [x] Deterministic file table tracking in `projectStore`
* [x] Export `.wyn` and refresh local snapshot

### Shared Helpers

* [x] `createProjectStore`
* [x] `buildWynArchive`
* [x] `createLayerBrowserStore`
* [x] `createMaskEditor`

### Development Workflow

* [x] `npm run build:lib`
* [x] `npm run build:viewer` / `npm run build:editor`
* [x] `npm run dev:all`
* [x] `.wyn` sample regeneration with `npm run packmap`

---

## ▶ Planned / In Progress Features

### Layer & Mask Tooling

* [ ] Layer asset uploads (heightmap, masks, overlays) with dimension validation + store integration
* [x] Topology editor (greyscale) with brush support
* [ ] Improved heightmap editing tools (raise/lower, sculpt presets, softness curves)
* [x] Ensure mask preview never loads blank (dataset fallback reliability)
* [ ] Preserve unsaved strokes on biome colour change (temp buffer + warnings)
* [x] Editable layer titles persisted into `legend`
* [x] Add biome / overlay dialogs (generate legend entry + seed mask asset)
* [ ] Layer reorder via drag/drop (needs between-item drop + better z-indexing)
* [ ] Harmonize editor drop targets with `.wyn` drop overlay (z-index + hit areas)
* [ ] Create/delete layer flows (with confirmation)
* [ ] Fill tool (paint bucket)
* [ ] Mask view toggle: B/W vs colour-coded
* [x] Onion-skin neighbouring layers with fading alpha
* [x] Brush opacity slider
* [x] Export mask directly from the Layer Editor (grayscale + alpha variants)
* [x] Layer editor viewport state persists via URL reloads & layer switches
* [ ] Brush type menu (basic, spray, Perlin noise)
* [ ] Save/load custom brushes (name + icon)
* [ ] Icon picker for brushes and locations based on FontAwesome Free icon set
* [ ] FontAwesome icon support for the viewer location markers
* [ ] Layer import via drag/drop or file upload

### Viewer & Interaction Improvements

* [ ] Camera recentering responding to dock + toolbar layout changes
* [ ] Zoom/pan calibration and cursor-to-world accuracy
* [x] Smooth scroll behavior (no jitter)
* [x] Layer editor wrapper must remain pointer-transparent
* [x] Cleanup of spacing/borders in layer toolbar + workspace UI

### Layer Editor Improvements

* [x] Undo/redo history for mask tooling
* [ ] Point-based heightmap editor (with JSON/PNG export)
* [ ] River polyline authoring that respects slope + widening rules
* [ ] Unified workspace covering heightmap, theme, locations, masks, thumbnails
* [ ] Image import + resize tools ensuring legend-dimension consistency
* [ ] Define command history + data contracts for sculpting, rivers, etc., with deterministic pack/unpack
* [ ] Expanded greyscale topology editor with undo/redo
* [ ] More advanced brush modes (spray, Perlin, texture-based)
* [ ] Brush preset manager (save/load brushes with icons)
* [ ] Additional mask visualization modes
* [ ] Advanced onion-skin controls
* [ ] High-level sculpting workflow (to pair with future topology editing)
* [ ] Break up `App.vue` into targeted composables/models (`useLayerEditor`, `useLayerAssets`, viewer helpers) so cross-cutting logic lives outside the root component
* [x] Brush spacing/flow controls + advanced panel menu for mask tooling
* [ ] Grid snap + measurement settings for mask tools
* [ ] Transform tool interactions (translate/scale/rotate selections)
* [ ] Layer editor + layers panel integration (shared layout, collapsible tools, dock-aware)
* [ ] Canvas viewport polish: remove nested scrollbars, auto fit/center, configurable background

### Viewer Backlog

* [ ] Make embed mode the default output
* [ ] Full pop-out and fullscreen controls via host helper
* [ ] Configuration hooks for host apps (theme overrides, UI toggles, analytics)

### Export / Repack Enhancements

* [ ] Export “JSON only” (`legend.json`, `locations.json`, `theme.json`)

### Guardrails & Architecture

* [ ] Maintain theme schema backward compatibility
* [ ] Always destroy `TerrainHandle` and call `dataset.cleanup()` on unload
* [ ] Require hosts to use shared overlay/popup helpers
* [ ] Preserve sprite scaling + opacity tied to camera distance + theme rules
* [ ] Avoid leaking object URLs (dispose preview caches)
* [ ] Run heavy tests only when necessary
