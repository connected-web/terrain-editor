# Terrain Editor — Agent Brief

## 1. Overview
- Web-based map editor + viewer powered by the shared `@connected-web/terrain-editor` package.
- Hosts must expose a single viewer container, wire the overlay helper, and load `.wyn` archives via the provided loader utilities.
- Editor shell mounts a 3D viewer, a multi-panel dock, asset dialogs, and project persistence/storage helpers.

## 2. Current Sprint Goals (Nov 19 2025)
- [x] Panel dock + toolbar contract (single active panel driven by shared UI actions).
- [x] Workspace panel for metadata (title/author/size/sea level) with instant viewer remount.
- [x] Locations tool (list, inspector, drag/drop uploads, asset picker, “pick on map”).
- [x] Theme editor (label/stem styling, hover/focus variants, reset to archive defaults).
- [x] Marker rendering tweaks (icon aspect ratio, borders honoring `showBorder`, stems react to zoom, placement waits for map click).
- [ ] Wire layer asset uploads (heightmap + overlays) into `projectStore` with dimension validation.
- [ ] Recentering helper so the camera/overlay reacts to dock or toolbar state.

## 3. Layer Editor Focus
- **What works now:** mask edits + biome colour tweaks persist to the project, remount correctly, and update the viewer without a full reload.
- **Outstanding polish:**
  - [ ] Mask preview occasionally loads as a black rectangle when the editor first opens.
  - [ ] Changing the biome colour while unsaved brush strokes exist still resets the temporary mask buffer.
  - [ ] Toolbar layout is cramped; colour picker, brush slider, mode buttons, and apply/reset controls should share a single row (WYSIWYG style).
  - [ ] Canvas area has excessive borders; upgrade to a pan/zoom workspace that fills the remaining dialog real estate.
  - [ ] Layer name (e.g., `LOW_GRASS`) should be editable and persist back to the legend.
  - [ ] Add biome / add overlay dialogs (patterned after `ConfirmDialog`) to append legend entries + seed mask assets.

## 4. Active Issues from QA/UX Feedback
1. Layer editor container (currently `width: 50vw`) blocks pointer events over the viewer — panel shell now needs pointer transparency except for the actual dialog.
2. Mask edits must only commit on “Apply changes”; interim edits should survive switching tools or opening the colour picker.
3. Need a zoom/pan affordance in the mask editor to work at high resolutions.
4. Reduce redundant borders (panel, toolbar, image frame).

## 5. Backlog — Editor
- [x] Persist active project into local storage for offline editing.
- [x] Support decompress/edit/repack of `.wyn` archives in-browser (`buildWynArchive`, `projectStore`).
- [ ] Layer asset uploads surface (heightmap, masks, overlays) with normalization + project store wiring.
- [ ] Viewer recentering tied to dock collapse/fullscreen actions.
- [ ] Expanded layer tooling: view/add/edit masks with undo/redo history.
- [ ] Point-based heightmap editor with JSON/PNG export.
- [ ] River polyline authoring that respects terrain slope/widening rules.
- [ ] Unified workspace editing for heightmap, theme, locations, masks, and thumbnails.
- [ ] Image import + resize utilities so new layers always match declared legend size.
- [ ] Define data contracts/command history for future tools (sculpting, rivers) to keep pack/unpack deterministic.

## 6. Backlog — Viewer
- [ ] Make embed mode the default output from the shared package.
- [ ] Finish pop-out dialog + fullscreen controls via the host helper.
- [ ] Expose configuration hooks for host apps (theme overrides, UI toggles, analytics events).

## 7. Export / Repack Pipeline
- [x] `buildWynArchive` helper (JSZip) that assembles legend, locations, theme, and layer assets.
- [x] Track decompressed file table in `projectStore` for deterministic edits.
- [x] “Save/Export .wyn” downloads the archive and refreshes the persisted snapshot.
- [ ] “Save JSON only” action to emit `legend.json`, `locations.json`, `theme.json` separately.

## 8. Shared Helper Modules
- `createProjectStore` — manages legend, locations, theme, file table, dirty tracking.
- `buildWynArchive` — produces `.wyn` blobs ready for download.
- `createLayerBrowserStore` — derives layer entries + visibility toggles for UI binding.
- `createMaskEditor` — brush primitives (paint/erase, undo/redo, import/export).

## 9. Guardrails
- Theme schema must remain backward compatible; tests should cover default + map overrides.
- Always destroy `TerrainHandle` and call `dataset.cleanup()` when unloading viewers.
- Viewer hosts should never reimplement overlay/popup controls—use the shared helper.
- Sprite scaling/opacity depend on camera distance and theme state; preserve hover/focus behaviour.

## 10. Dev Workflow Reminders
- `npm run build:lib` — build shared package before publishing/consuming.
- `npm run build:viewer` / `npm run build:editor` — deterministic demo builds after UI changes.
- `npm run dev:all` — boots viewer/editor/website on ports 4173/4175/4176 (Ctrl+C to stop).
- `.wyn` archives live under `maps/`; `npm run packmap` regenerates samples.
- Preferred branch: `fix/marker-sizes-by-setting-location-ids`.
- Avoid leaking object URLs; dispose preview caches when removing/replacing assets.
- Heavy test suites (`npm run test:smoke`, `npm run test:e2e`, `npm test`) are slow—run only on request.
