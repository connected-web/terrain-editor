# Development Roadmap

## Terrain Editor Package

### Core Infrastructure
- ✅ Expose a single viewer container
- ✅ Connect the shared overlay helper
- ✅ Load `.wyn` archives through loader utilities
- ✅ `createProjectStore`, `buildWynArchive`, `createLayerBrowserStore`, `createMaskEditor`
- ✅ In-browser `.wyn` decompress/edit/repack pipeline
- ✅ Deterministic file table tracking in `projectStore`
- ✅ Export `.wyn` and refresh local snapshot

### Tooling & Workflow
- ✅ `npm run build:lib`
- ✅ `npm run build:viewer` / `npm run build:editor`
- ✅ `npm run dev:all`
- ✅ `.wyn` sample regeneration with `npm run packmap`
- 💡 Run heavy tests only when necessary

### Guardrails & Architecture
- 💡 Maintain theme schema backward compatibility
- 💡 Always destroy `TerrainHandle` and call `dataset.cleanup()` on unload
- 💡 Require hosts to use shared overlay/popup helpers
- 💡 Preserve sprite scaling + opacity tied to camera distance + theme rules
- 💡 Avoid leaking object URLs (dispose preview caches)

### Export Enhancements
- 💡 Export “JSON only” (`legend.json`, `locations.json`, `theme.json`)

## Website

### Hosting & Presentation
- ✅ GitHub Pages hosting
- 💡 More editor-facing documentation pages
- 💡 Release notes and changelog section

## Editor

### Workspace & Panels
- ✅ 3D viewer
- ✅ Multi-panel dock + toolbar
- ✅ Asset dialogs
- ✅ Project persistence + storage helpers
- ✅ Workspace panel for metadata (title, author, size, sea level) with viewer remount
- 💡 Unified workspace covering heightmap, theme, locations, masks, thumbnails
- 💡 Layer editor + layers panel integration (shared layout, collapsible tools, dock-aware)

### Locations & Theme
- ✅ Locations tool: list, inspector, drag/drop uploads, asset picker, pick-on-map
- ✅ Theme editor: label + stem styling, hover/focus variants, reset-to-default
- ✅ Marker rendering: icon aspect ratio, optional border, zoom-reactive stems, placement waits for click
- 💡 Icon picker for brushes and locations based on FontAwesome Free icon set

### Layers & Masks
- ✅ Mask editing persists and remounts correctly
- ✅ Biome colour editing updates viewer without reload
- ✅ Toolbar-integrated colour picker
- ✅ Canvas zoom/pan
- ✅ Brush cursor reflects size
- ✅ Topology editor (greyscale) with brush support
- ✅ Ensure mask preview never loads blank (dataset fallback reliability)
- ✅ Editable layer titles persisted into `legend`
- ✅ Add biome / overlay dialogs (generate legend entry + seed mask asset)
- ✅ Mask view toggle: B/W vs colour-coded
- ✅ Onion-skin neighbouring layers with fading alpha
- ✅ Brush opacity slider
- ✅ Export mask directly from the Layer Editor (grayscale + alpha variants)
- ✅ Layer editor viewport state persists via URL reloads & layer switches
- ✅ Undo/redo history for mask tooling
- ✅ Brush spacing/flow controls + advanced panel menu for mask tooling
- ✅ Layer asset uploads (heightmap, masks, overlays) with dimension validation + store integration
- ✅ Brush presets + pinned overrides (size/opacity) for mask tooling
- ✅ Flat tool ink sampling from existing heightmap values
- ✅ Improved heightmap editing tools (raise/lower, sculpt presets, softness curves)
- ✅ Preserve unsaved strokes on biome colour change (temp buffer + warnings)
- ✅ Layer reorder via drag/drop (needs between-item drop + better z-indexing)
- ✅ Harmonize editor drop targets with `.wyn` drop overlay (z-index + hit areas)
- ✅ Create/delete layer flows (with confirmation)
- ✅ Fill tool (paint bucket)
- ✅ Brush type menu (basic, spray, Perlin noise)
- ✅ Fix brush cursor vs stamp alignment at non-1x zoom
- ✅ Save/load custom brushes
  - 💡 Save custom brushes with name + icon
- ✅ Layer import via file upload
- ✅ More advanced brush modes (spray, Perlin, texture-based)
- ✅ Brush preset manager
  - 💡 Save/load brushes with custom icons
- 💡 Selection tool (rect + fill, persistent across layers)
- 💡 Additional mask visualization modes
- ✅ Advanced onion-skin controls
- 💡 Grid snap + measurement settings for mask tools
- 💡 Transform tool interactions (translate/scale/rotate selections)
- 💡 Canvas viewport polish: remove nested scrollbars, auto fit/center, configurable background

### Heightmap & Sculpting
- 💡 Point-based heightmap editor (with JSON/PNG export)
- 💡 Expanded greyscale topology editor with undo/redo
- 💡 Define command history + data contracts for sculpting, rivers, etc., with deterministic pack/unpack
- 💡 River polyline authoring that respects slope + widening rules
- 💡 High-level sculpting workflow (to pair with future topology editing)

## Viewer

### Interaction
- ✅ Smooth scroll behavior (no jitter)
- ✅ Layer editor wrapper must remain pointer-transparent
- ✅ Cleanup of spacing/borders in layer toolbar + workspace UI
- 💡 Camera recentering responding to dock + toolbar layout changes
- 💡 Zoom/pan calibration and cursor-to-world accuracy

### Feature Backlog
- 💡 Make embed mode the default output
- 💡 Full pop-out and fullscreen controls via host helper
- 💡 Configuration hooks for host apps (theme overrides, UI toggles, analytics)
- 💡 FontAwesome icon support for the viewer location markers

## Sample Maps

### Assets & Pipelines
- ✅ Sample `.wyn` packaging via `npm run packmap`
- ✅ Sample `.wyn` unpacking via `npm run unpackmap`
- 💡 Additional curated sample terrains for testing editor flows
