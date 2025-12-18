# @connected-web/terrain-editor

A TypeScript library for loading, viewing, and editing `.wyn` terrain files in the browser using Three.js.

## Installation

```bash
npm install @connected-web/terrain-editor three
```

## What are .wyn files?

`.wyn` files are compressed archives containing terrain data with the following structure:

- `legend.json`: Metadata about the terrain (layers, name, author, description)
- `layers/*.png`: Terrain layers (heightmap, colormap, normalmap, etc.)
- `locations.json`: Predefined camera locations and points of interest
- `theme.json`: Visual theme for markers and UI elements
- `thumbnails/thumbnail.png`: Preview thumbnail

## Usage

### Loading a Wyn Archive

```typescript
import { loadWynArchive } from '@connected-web/terrain-editor'

const archive = await loadWynArchive('/path/to/terrain.wyn')

console.log(archive.legend)      // Terrain metadata
console.log(archive.layers)      // Layer image data
console.log(archive.locations)   // Points of interest
console.log(archive.theme)       // Visual theme
```

### Creating a Terrain Viewer

```typescript
import { TerrainViewer } from '@connected-web/terrain-editor'
import * as THREE from 'three'

const viewer = new TerrainViewer({
  container: document.getElementById('viewer'),
  archive: archive,
  onLocationClick: (location) => {
    console.log('Clicked:', location.label)
  }
})

// Start rendering
viewer.start()

// Clean up when done
viewer.dispose()
```

### Geometry Utilities

```typescript
import {
  createHeightSampler,
  sampleHeightValue,
  applyHeightField
} from '@connected-web/terrain-editor'

// Sample height values from a texture
const sampler = createHeightSampler(heightTexture)
const height = sampleHeightValue(sampler, u, v)

// Apply heightfield to plane geometry
const geometry = new THREE.PlaneGeometry(100, 100, 256, 256)
applyHeightField(geometry, sampler, {
  seaLevel: 0.3,
  heightScale: 20
})
```

### Editor Features

For building and editing terrain archives:

```typescript
import {
  ProjectStore,
  buildWynArchive
} from '@connected-web/terrain-editor'

// Create a new project
const project = new ProjectStore()
project.setLegend({
  name: 'My Terrain',
  description: 'Custom terrain map',
  layers: [
    { name: 'heightmap', type: 'height' },
    { name: 'colormap', type: 'color' }
  ]
})

// Build archive
const blob = await buildWynArchive(project)
```

## API Reference

### Core Modules

- **`loadWynArchive`**: Load and parse .wyn files
- **`TerrainViewer`**: Complete 3D terrain viewer with controls
- **`ViewerHost`**: Lower-level scene/camera management
- **`ViewerOverlay`**: UI overlay for locations and markers

### Geometry

- **`createHeightSampler`**: Sample height data from textures
- **`applyHeightField`**: Apply height displacement to geometry
- **`buildRimMesh`**: Generate terrain edge geometry

### Editor

- **`ProjectStore`**: State management for terrain editing
- **`buildWynArchive`**: Package terrain data into .wyn format
- **`LayerBrowser`**: Layer management utilities
- **`MaskToolkit`**: Layer masking and blending

### Theming

- **`MarkerSpriteTheme`**: Customize location marker appearance
- **`MarkerStemTheme`**: Customize marker stems (3D poles)

## Examples

See the full demos:

- [Viewer Demo](https://connected-web.github.io/terrain-editor/viewer-js/) - Vanilla TypeScript viewer
- [Editor Demo](https://connected-web.github.io/terrain-editor/editor/) - Full-featured Vue 3 editor

## Requirements

- Three.js ^0.181.1
- Modern browser with WebGL support

## License

ISC

## Repository

https://github.com/connected-web/terrain-editor
