# terrain-editor

An interactive terrain editor and viewer designed for web using three.js.

## Wyn files

This terrain editor loads compressedd `.wyn` files which have the following package structure:

- `legend.json`: Metadata about the terrain, including layers, name, author, and description.
- `layers/layername.png`: PNG files representing different terrain layers (e.g., heightmap, colormap, normalmap).
- `thumbnails/thumbnail.png`: (Optional) A thumbnail image representing the terrain.
- `locations.json` : (Optional) A JSON file containing predefined camera locations and related information for the terrain.
- `theme.json`: (Optional) A JSON file defining the visual theme for the terrain viewer, including colors and styles for various UI elements.

## Usage

The viewer component creates a 3D scene which can load and unpack Wyn files into browser memory. This provides a navigable interface for exploring terrain data.

- [Viewer demo (TS)](https://connected-web.github.io/terrain-editor/viewer-js/)
- [Viewer demo (Vue 3)](https://connected-web.github.io/terrain-editor/viewer-vue3/)
- [Editor (Vue 3)](https://connected-web.github.io/terrain-editor/editor/)

### Demos

- `npm run dev:viewer` / `npm run dev:viewer-vue` / `npm run dev:editor` – Run the TS viewer, Vue viewer, or Vue editor harnesses locally.
- `npm run build:viewer` / `npm run build:viewer-vue` / `npm run build:editor` – Build demos individually.
- `npm run build:lib` – Build the shared `@connected-web/terrain-editor` package via tsup.
- `npm run build` – Produce a combined `dist/` folder with the website root plus `/viewer-js`, `/viewer-vue3`, `/editor/`, and hosted `.wyn` assets for GitHub Pages.

### Testing

- `npm run test:smoke` – Launches Vite preview servers for the website and each demo, performing a basic HTTP fetch to ensure they respond successfully.

Example use case:

```typescript
import { TerrainViewer } from '@connected-web/terrain-editor'

async function setup() {
  const viewer = new TerrainViewer({
    container: document.getElementById('terrain-container'),
  });

  await viewer.loadWynFile('path/to/terrain.wyn')
}

setup()
  .then(() => console.log('Terrain loaded'))
  .catch((err) => console.error('Error loading terrain:', err))
```

### Embedding the shared viewer UI

The package now ships a self-contained overlay (status text, load button, pop-out/fullscreen controls, drag/drop prompt) and a host helper that moves the `<canvas>` between an embed slot and a modal pop-out. To wire them up:

1. Render a single container element for the viewer and keep it mounted—hosts should not sprinkle bespoke buttons or additional DOM inside it.
2. Call `createViewerOverlay(container, callbacks)` to inject the chrome and connect overlay callbacks (`onFileSelected`, `onRequestPopout`, `onRequestClosePopout`, `onRequestFullscreenToggle`) to your host logic.
3. Call `createTerrainViewerHost({ viewerElement, embedTarget })` so the helper can move the renderer between the embed slot and the pop-out shell. Pass `onModeChange` back into the overlay handle so it can toggle button labels.
4. Load `.wyn` archives through `loadWynArchive` / `loadWynArchiveFromFile` and pass the resulting dataset into `initTerrainViewer`.

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

This mirror the TS + Vue demos, so run `npm run build:viewer` or `npm run build:viewer-vue` if you want a reference implementation.

## Editor

To make construction of the terrain easier, a Vue 3 based editor application is provided in the `editor/` directory. This application allows users to create and modify terrain data, which can then be exported as `.wyn` files for use in the viewer. You can also host your own instance of the editor if desired to make customizations.

- [Website](https://connected-web.github.io/terrain-editor/)
- [Editor (Vue 3)](https://connected-web.github.io/terrain-editor/editor/)

## License

ISC License. See [LICENSE](LICENSE.md) for details.

## Author

Created and maintained by Connected Web.

Copyright 2025 Connected Web.

## Project structure

- `packages/terrain` – source for the `@connected-web/terrain-editor` package (viewer/editor utilities).
- `demos/viewer-ts` – Vanilla TypeScript harness that loads `.wyn` files via `loadWynArchive`.
- `demos/viewer-vue3` – Vue 3 wrapper harness validating reactive integration before landing in the editor.
- `editor` – Early editor workspace with metadata + location tooling.
- `website` – Vue 3 SPA for marketing pages and the future editor shell.
- `maps/` – Source assets used to build sample Wyn archives (e.g., `wynnal-terrain.wyn`).

## Development roadmap

- ✅ Setup basic website hosting through github pages
- 🚧 Publish reusable packages to npm as `@connected-web/terrain-editor`

### Viewer

- ✅ Create shared three.js logic for viewing maps
- ✅ Create example viewer application (pure Vanilla TS)
- ✅ Create example viewer application (Vue 3 + TS)
- ✅ Create example `.wyn` file using local assets
- ✅ Implement loading and unpacking of `.wyn` files

### Editor

- ✅ Create basic editor application (Vue 3 + TS)
- 🚧 Implement loading and unpacking of `.wyn` files into editor
- 🚧 Implement basic editing of terrain data, e.g. JSON data
- 🚧 Implement exporting of `.wyn` files
- 🚧 Implement resizing of terrain layers (image manipulation)
- 🚧 Implement mask editing tools (brushes, noise, etc.)
- 🚧 Implement heightmap editing tools (point files, falloff, rivers, etc.)
- 🚧 Implement location editing tools (add pins, edit pins)
