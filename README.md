# terrain-editor

An interactive terrain editor and viewer designed for web using three.js.

>*The goal was to make an interactive map for my website, and a long the way it grew into a full layer, location, and heightmap editor, with full import/export options.*

## Wyn files

This terrain editor loads compressed `.wyn` files which have the following package structure:

- `legend.json`: Metadata about the terrain, including layers, name, author, and description.
- `layers/layername.png`: PNG files representing different terrain layers (e.g., heightmap, colormap, normalmap).
- `thumbnails/thumbnail.png`: (Optional) A thumbnail image representing the terrain.
- `locations.json` : (Optional) A JSON file containing predefined camera locations and related information for the terrain.
- `theme.json`: (Optional) A JSON file defining the visual theme for the terrain viewer, including colors and styles for various UI elements.

Full spec: [`documentation/WYN-FILE-FORMAT.md`](./documentation/WYN-FILE-FORMAT.md)

## Usage

The viewer component creates a 3D scene which can load and unpack Wyn files into browser memory. This provides a navigable interface for exploring terrain data.

- [Project Website](https://connected-web.github.io/terrain-editor/)
- [Example Viewer](https://connected-web.github.io/terrain-editor/viewer-js/)
- [Editor Website](https://connected-web.github.io/terrain-editor/editor/)

<kbd>
<img width="1439" height="788" alt="terrain-editor" src="https://github.com/user-attachments/assets/fb54609e-9de6-46d5-9c78-9a0b6cf89c7a" />
</kbd>

<kbd>
<img width="1177" height="685" alt="terrain-viewer" src="https://github.com/user-attachments/assets/0deb5467-a0e7-4e1e-a311-1dc1e8c62c97" />
</kbd>

### Demos

- `npm run dev:viewer` / `npm run dev:editor` – Run the TS viewer or Vue editor harness locally.
- `npm run dev:all` – Launch viewer, editor, and website dev servers together. CTRL+C stops everything cleanly and clears stale processes.
- `npm run build:viewer` / `npm run build:editor` – Build demos individually.
- `npm run build:lib` – Build the shared `@connected-web/terrain-editor` package via tsup.
- `npm run build` – Produce a combined `dist/` folder with the website root plus `/viewer-js`, `/editor/`, and hosted `.wyn` assets for GitHub Pages.

During development each harness uses a fixed Vite port so the cross-links keep working:

- Viewer → `http://localhost:4173/viewer-js/`
- Editor → `http://localhost:4175/editor/`
- Website → `http://localhost:4176/`

The website CTA buttons link directly to those ports during development so you always land on the correct running server.

### Testing

- `npm run test:smoke` – Launches Vite preview servers for the website and each demo, performing a basic HTTP fetch to ensure they respond successfully.

### Quick start

`@connected-web/terrain-editor` exposes `createTerrainViewerHost`, `createViewerOverlay`, `initTerrainViewer`, `loadWynArchive`, `loadWynArchiveFromFile`, `createIconUrlMap`, and `enhanceLocationsWithIconUrls`. The viewer now assumes a single long-lived container plus an overlay helper that injects file inputs, drag/drop status, and pop-out/fullscreen buttons. Wire them together as shown below:

```ts
import {
  createTerrainViewerHost,
  createViewerOverlay,
  initTerrainViewer,
  loadWynArchive,
  loadWynArchiveFromFile
} from '@connected-web/terrain-editor'

const embedSlot = document.getElementById('viewer-embed-slot')
const viewerRoot = document.getElementById('viewer-root')

const overlayHandle = createViewerOverlay(viewerRoot, {
  onFileSelected: (file) => loadArchive({ kind: 'file', file }),
  onRequestPopout: () => hostHandle.openPopout(),
  onRequestClosePopout: () => hostHandle.closePopout(),
  onRequestFullscreenToggle: () => hostHandle.toggleFullscreen()
})

const hostHandle = createTerrainViewerHost({
  viewerElement: viewerRoot,
  embedTarget: embedSlot,
  onModeChange: (mode) => overlayHandle.setViewMode(mode)
})

async function loadArchive(source: { kind: 'default' } | { kind: 'file'; file: File }) {
  const archive =
    source.kind === 'default'
      ? await loadWynArchive('/maps/wynnal-terrain.wyn')
      : await loadWynArchiveFromFile(source.file)
  await initTerrainViewer(viewerRoot, archive.dataset, {
    locations: archive.locations,
    layers: {
      biomes: Object.fromEntries(Object.keys(archive.legend.biomes).map((key) => [key, true])),
      overlays: Object.fromEntries(Object.keys(archive.legend.overlays).map((key) => [key, true]))
    }
  })
}
```

This mirrors the TS viewer demo, so run `npm run build:viewer` if you want a reference implementation.

#### Working with icon assets

`loadWynArchive(..., { includeFiles: true })` returns the original file table so you can read arbitrary blobs from the `.wyn` archive:

```ts
const archive = await loadWynArchive('/maps/wynnal-terrain.wyn', { includeFiles: true })
console.log(archive.files?.[0])
// {
//   path: 'icons/pins/quest.png',
//   data: ArrayBuffer,
//   type: 'image/png',
//   lastModified: 1702784635000,
//   sourceFileName: 'quest.png'
// }
```

To display those icons, convert the buffers into object URLs. `createIconUrlMap` does that once and hands back a `Map` (keyed by file path) plus a `cleanup()` helper that revokes all generated URLs:

```ts
const { urls, cleanup } = createIconUrlMap(archive.files)
const questIconUrl = urls.get('icons/pins/quest.png') // -> blob:http://... object URL
```

`enhanceLocationsWithIconUrls` is a convenience wrapper on top of the same map. It accepts the raw `archive.locations` array and returns a cloned list in which each item optionally includes an `iconUrl` property (sourced from the matching icon file):

```ts
import { enhanceLocationsWithIconUrls, loadWynArchive } from '@connected-web/terrain-editor'

const archive = await loadWynArchive('/maps/wynnal-terrain.wyn', { includeFiles: true })

const { locations, cleanup } = enhanceLocationsWithIconUrls(archive.locations ?? [], archive.files)

locations.forEach((loc) => {
  renderMarker({
    id: loc.id,
    iconUrl: loc.iconUrl, // undefined if no matching icon file
    coordinates: loc.pixel
  })
})

onBeforeUnmount(cleanup)
```

Both helpers keep their own URL cache, so call `cleanup()` when the archive is unloaded or when you need to reclaim browser memory.

### Embedding the shared viewer UI

The package ships a self-contained overlay (status text, load button, pop-out/fullscreen controls, drag/drop prompt) plus a host helper that moves the `<canvas>` between an embed slot and a modal pop-out. Stick to the “single container div/ref” contract outlined in `AGENTS.md` so Vue/React/TS demos all share the same behavior.

## Editor

To make construction of the map files and terrain easier, a browser based editor application is provided in the `editor/` directory. This application allows users to create and modify terrain data, which can then be exported as `.wyn` files for use in the viewer. You can also host your own instance of the editor if desired to make customizations.

- [Project Website](https://connected-web.github.io/terrain-editor/)
- [Terrain Editor](https://connected-web.github.io/terrain-editor/editor/)

#### Workspace features

- **Panel dock + toolbar** – a single docked column hosts workspace/layers/theme/locations panels, while the shared toolbar injects context-aware UI actions (load, export, open panel). Collapsing the dock hides toolbar labels so the viewer keeps its footprint.
- **Workspace panel** – edit project title, author, width, height, and sea level with validation. Legend changes remount the viewer immediately so the mesh always matches the declared resolution.
- **Locations panel** – browse locations, select one to edit, upload or drag/drop icon assets, toggle label borders, and click “Pick on map” to place a marker interactively. The asset dialog handles caching + replacement for shared icons.
- **Theme panel** – tweak marker text/background/border colors, border thickness, opacity, stem colors/opacity, and even the stem geometry shape. Hover/focus overrides and reset buttons keep experimentation safe.
- **Marker rendering** – icons preserve their aspect ratios, optional label borders, and responsive scaling (about 50% smaller by default), while stems change width as you zoom and location creation now waits for a map click before committing.
- **Asset + confirm dialogs** – destructive operations now use a reusable confirm dialog, and the asset library surfaces thumbnails, metadata, and remove/select flows so other panels can reuse the same UX.

### Editor architecture

The Vue workspace is intentionally light on bespoke logic; most of the heavy lifting now lives in `packages/terrain/src/editor`:

- `createProjectStore` – maintains the decompressed file table, legend/locations/theme metadata, and dirty flags so editors can persist/reload the current project.
- `buildWynArchive` – repacks the canonical project graph back into a `.wyn` Blob (used by “Save/Export” flows).
- `createLayerBrowserStore` – produces toggle state + metadata for biome/overlay layers based on a legend so multiple UIs share a consistent view of layer visibility.
- `createMaskEditor` – pure canvas-free brush utilities (paint/erase strokes, undo/redo, drag/drop import) that emit reusable mask buffers.

Vue components should compose these helpers and focus on layout/state presentation. When you need a new editing primitive, add it to the shared package first so future hosts (React, Web Components, etc.) get the functionality for free.

## License

ISC License. See [LICENSE](LICENSE.md) for details.

## Author

Created and maintained by Connected Web.

Copyright 2025 Connected Web.

## Project structure

- `packages/terrain` – source for the `@connected-web/terrain-editor` package (viewer/editor utilities).
- `demos/viewer-ts` – Vanilla TypeScript harness that loads `.wyn` files via `loadWynArchive`.
- `editor` – Vue 3 editor workspace with layers/masks, locations, theme designer, and export flows.
- `website` – Vue 3 SPA for marketing pages and the future editor shell.
- `maps/` – Source assets used to build sample Wyn archives (e.g., `wynnal-terrain.wyn`).
- `documentation/` – Screenshots, GIFs, and render artifacts referenced by the user guide.
- `tests/` – Playwright suites (navigation screenshots + animation captures).
- `scripts/` – Shared build/dev helpers (build-dist, dev-all, smoke tests, etc.).

## Development roadmap

See [`DEVELOPMENT-ROADMAP.md`[./DEVELOPMENT_ROADMAP.md] for the current list of completed and planned channges. Use Github Issues if you'd like to raise a feature suggestion, or find a bug. 