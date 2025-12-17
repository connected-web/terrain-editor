# Terrain Editor User Guide

This guide summarizes the current capabilities of the terrain editor so new contributors can quickly understand what works today.

## Panels & Workspace

### Panel Dock + Toolbar
Single-column dock hosts Workspace, Layers, Theme, Locations, and Settings panels. Toolbar keeps context-aware actions (Load sample, Export WYN, Close map) and collapses labels automatically when the dock is hidden.

![Terrain Editor home with dock and toolbar](documentation/images/editor-home.png)

### Workspace Panel
Edit project title, author, width/height, and sea level. Viewer remounts automatically when map dimensions change so the canvas always matches the declared resolution.

![Workspace panel showing project metadata form](documentation/images/panel-workspace.png)

### Layers Panel
- Layer list with drag handles, visibility toggles, onion-skin toggles, and reorder-on-drop within sections.
- Hovering a pill shows handles, quick visibility toggles, and onion-skin controls while respecting section hints.
- Click any layer to open it in the editor or drag to reorder within compatible sections.

![Layers panel overview](documentation/images/panel-layers.png)

### Layer Editor
- Opens inline with the mask canvas, tool palette, brush settings, and per-layer utilities (export, reset, onion skin).
- Mask tools include brush/erase/flatten (heightmap), hand/pan, plus size/opacity/softness/spacing/flow sliders and advanced spacing/flow controls.
- Canvas utilities: checkerboard or solid background, **Mask view toggle (B/W or Colour)**, undo/redo history, onion-skin overlays, export mask (with optional alpha), fit/zoom 100%, view-state persistence via URL `leo` param.

**Height Map tooling example**

![Layer editor height map tools](documentation/images/layer-editor-height-map.png)

**Forest biome editing example**

![Layer editor forest biome tools](documentation/images/layer-editor-forest.png)

### Theme Panel
Edit marker sprite, label, and stem colours for normal/hover/focus states. Reset helpers and stem shape selection.

![Theme panel label controls](documentation/images/panel-theme.png)

### Locations Panel
List, pick-on-map, drag/drop icon assets, toggle label borders, rename/delete, and camera snapshot controls.

![Locations panel with Castle selected](documentation/images/panel-locations-selected-castle.png)

<a href="documentation/animations/looping-location-demo-capture.mp4">
  <kbd>
    <img alt="Looping Locations demo" src="documentation/animations/looping-location-demo-capture.gif" />
  </kbd>
</a>

### Settings Panel
Placeholder for local/editor preferences (expand as needed).

![Settings panel local options](documentation/images/panel-settings.png)

## Project & Assets

- Load `.wyn` archives from disk (drag/drop or file picker). Assets and metadata hydrate workspace state via `createProjectStore`.
- Save/export: rebuild `.wyn` with deterministic file tables and updated legend/theme/locations via `buildWynArchive`.
- Asset library dialog manages shared icons, previews, replacements, and deletions with URL cache cleanup.

## Viewer Integration

- Embedded three.js viewer shares state with the editor. Camera URL params (`camera`) and layer visibility (`layers`) stay in sync through `useUrlState`.
- Onion-skin overlays fade neighbouring masks for context without blocking input.

## Keyboard & Interaction

- Tool palette includes shortcut hints (B/E/F/G/S/H/T). Mask editor supports pointer pan (hand tool or hold space in future) and holds view state until user interacts.
- Confirm dialogs protect destructive operations (e.g., delete layer, close map).

## Mask View Toggle (New)

- Layer settings now include a “Mask view” segmented control (B/W vs Colour). Colour mode overlays the mask using the layer’s tint to help inspect overlapping biomes. Heightmaps automatically fall back to B/W since colour tint doesn’t apply.

## URL Parameters for Deep Linking

The editor supports several URL parameters to allow direct navigation to specific states for testing, documentation, or sharing:

- `panel`: Open a specific panel (e.g., `?panel=layers`)
- `layer`: Select a specific layer by ID (e.g., `?layer=biome:forest`)
- `camera`: Set the viewer camera (e.g., `?camera=1.8,0.9,1.8,530,746`)
- `leo`: Set the layer editor view state (zoom/center)
- `location`: Select a specific location by ID (e.g., `?location=capital`)

**Example:**

```
/editor/?panel=locations&location=capital&camera=1.8,0.9,1.8,530,746
```

This will open the editor with the Locations panel active, select the location with ID `capital`, and set the camera to the specified state.

These parameters are useful for Playwright tests, documentation screenshots, and sharing reproducible scenes.

---

Future updates: integrate layer asset uploads, more brush types/noise, custom brush presets, and GIF/Video captures for documentation via Playwright traces + ffmpeg.
