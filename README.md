# terrain-editor

An interactive terrain editor and viewer designed for web using three.js.

## Wyn files

This terrain editor loads compressedd `.wyn` files which have the following package structure:

- `legend.json`: Metadata about the terrain, including layers, name, author, and description.
- `layers/layername.png`: PNG files representing different terrain layers (e.g., heightmap, colormap, normalmap).
- `thumbnails/thumbnail.png`: (Optional) A thumbnail image representing the terrain.
- `locations.json` : (Optional) A JSON file containing predefined camera locations and related information for the terrain.

## Usage

The viewer component creates a 3D scene which can load and unpack Wyn files into browser memory. This provides a navigable interface for exploring terrain data.

- 🚧 TODO: Provide link to plain JS viwer demo, and Vue 3 viwer demo

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

## Editor

To make construction of the terrain easier, a Vue 3 based editor application is provided in the `editor/` directory. This application allows users to create and modify terrain data, which can then be exported as `.wyn` files for use in the viewer. You can also host your own instance of the editor if desired to make customizations.

- 🚧 TODO: Provide link to JS Editor demo, and Vue 3 editor demo

## License

ISC License. See [LICENSE](LICENSE.md) for details.

## Author

Created and maintained by Connected Web.

Copyright 2025 Connected Web.

## Development roadmap

- 🚧 Port project settings over from jmarkavian.com website
- 🚧 Setup basic website hosting through github pages

### Viewer

- 🚧 Create shared three.js logic for viewing maps
- 🚧 Create example viewer application (pure Vanilla TS)
- 🚧 Create example viewer application (Vue 3 + TS)
- 🚧 Create example `.wyn` file using local assets
- 🚧 Implement loading and unpacking of `.wyn` files

### Editor

- 🚧 Create basic editor application (Vue 3 + TS)
- 🚧 Implement loading and unpacking of `.wyn` files into editor
- 🚧 Implement basic editing of terrain data, e.g. JSON data
- 🚧 Implement exporting of `.wyn` files
- 🚧 Implement resizing of terrain layers (image manipulation)
- 🚧 Implement mask editing tools (brushes, noise, etc.)
- 🚧 Implement heightmap editing tools (point files, falloff, rivers, etc.)
- 🚧 Implement location editing tools (add pins, edit pins)

