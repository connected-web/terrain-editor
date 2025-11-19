# Terrain Editor Task List

## Active Sprint (19 Nov 2025)
- [x] Re-export `initTerrainViewer` from `terrainViewer.ts` and ensure public API uses the new path. *Touch files:* `packages/terrain/src/index.ts`, `terrainViewer.ts`. *Test:* `npm run build:lib`.
- [x] Embed shared viewer chrome inside the package:
  - [x] Inject overlay DOM (status text, load button, pop-out/full-screen, drag/drop prompt) when the viewer mounts. *Files:* `packages/terrain/src/viewerOverlay.ts`, `terrainViewer.ts`.
  - [x] Inject the required stylesheet into the document head to keep demos minimal.
  - [x] Wire overlay controls to host helper + local `.wyn` loader so hosts only pass callbacks. *Ensure `loadWynArchive` utilities remain the single entry point.*
- [x] Update TS and Vue demos to the “single container div/ref” contract:
  - [x] Remove bespoke buttons/markup; each demo now provides a container + overlay helper.
  - [x] Verify both demos support URL load, file upload, drag/drop, pop-out, and fullscreen. *Tests:* `npm run build:viewer`, `npm run build:viewer-vue`, `npm run test:smoke`.
- [ ] Document the new embed API in README/AGENTS so other agents know how to bootstrap the viewer.

## Backlog – Editor
- [ ] Persist active project into local storage for offline editing.
- [ ] Allow decompress/edit/repack of `.wyn` archives entirely in-browser.
- [ ] Expand layer tooling: view, add, edit, and paint masks with undo/redo.
- [ ] Implement point-based heightmap editor + JSON/PNG export path.
- [ ] Author river polylines that respect terrain slope and widening rules.
- [ ] Extend editor UI to edit heightmap, theme, locations, layer masks, and thumbnails from one workspace.

## Backlog – Viewer
- [ ] Support embed mode as default output from the shared package.
- [ ] Provide pop-out dialog + fullscreen controls via host helper (in progress).
- [ ] Expose configuration hooks for host apps (theme overrides, UI toggles, analytics events).
- [ ] Expose configuration hooks for host apps (theme overrides, UI toggles, analytics events).

## Completed / Guardrails
- Theme system with per-state sprite/stem styling and `.wyn` overrides. **Guardrail:** keep JSON schema backward compatible; tests should cover default + map override merges.
- Local `.wyn` loading (URL + file/drag-drop) and resource cleanup. **Guardrail:** never leak object URLs; always call `dataset.cleanup()` on viewer destroy/reload.
- Viewer host helper for pop-out/fullscreen scaffolding. **Guardrail:** overlay and control hooks must remain accessible via the shared helper—demos should never re-implement modal logic.
- Height/terrain rendering pipeline (terrain mesh, water volume, markers). **Guardrail:** sprite scaling and opacity depend on camera distance/focus; changes must preserve hover/focus behavior and theme-driven styles.

## How to Work on This Repo
- `npm run build:lib` – builds the package (must pass before publishing or consuming from demos).
- `npm run build:viewer`, `npm run build:viewer-vue` – smoke-test TS and Vue harnesses.
- `.wyn` archives live under `maps/`; use `npm run packmap` to regenerate after edits.
- Preferred branch: `fix/marker-sizes-by-setting-location-ids` (current working branch). Keep changes scoped; avoid rewriting unrelated files.
- Always destroy viewer handles (`TerrainHandle.destroy()`) and call `dataset.cleanup()` when tearing down live demos to avoid leaking object URLs.
- **Script guide (agent-friendly usage):**
  - ✅ `npm run build:lib` – safe; required after editing package source.
  - ✅ `npm run build:viewer`, `npm run build:viewer-vue`, `npm run build:editor-vue` – deterministic builds for demos; run after UI changes.
  - ✅ `npm run packmap` – regenerates the sample `.wyn`; harmless but only needed when changing map assets.
  - ✅ `npm run build` – bundles the entire monorepo; slower but acceptable before releases.
  - ⚠️ `npm run dev:*` – starts Vite dev servers; avoid unless interactive debugging is explicitly requested.
  - ⚠️ `npm run preview:dist` – spins up a web server; requires user approval/network access.
- ⚠️ `npm run test:smoke` – builds every demo, serves `dist`, and now validates response bodies. Requires opening a local HTTP server; may fail in restricted environments.
- ⚠️ `npm run test:e2e` – Playwright suite that captures screenshots (useful for LLM review). Expect multi-minute runtime.
- ⚠️ `npm test` – runs the full smoke + e2e pipeline (10+ minutes). Only launch when the user specifically asks for comprehensive validation.
