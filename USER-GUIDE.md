# Terrain Editor User Guide

This guide summarizes the current capabilities of the terrain editor so new contributors can quickly understand what works today.

## Panels & Workspace

### Panel Dock + Toolbar
Single-column dock hosts Workspace, Layers, Theme, Locations, and Settings panels. Toolbar keeps context-aware actions (Load sample, Export WYN, Close map) and collapses labels automatically when the dock is hidden.

### Workspace Panel
Edit project title, author, width/height, and sea level. Viewer remounts automatically when map dimensions change so the canvas always matches the declared resolution.

### Layers Panel & Layer Editor
- Layer list with drag handles, visibility toggles, onion-skin toggles, and reorder-on-drop within sections.
- Layer Editor opens inline with mask canvas, tool palette, brush settings, and layer utilities.
- Mask tools: brush/erase/flatten (heightmap), hand/pan. Brush supports size, opacity, softness, spacing, flow sliders plus advanced settings (spacing/flow).
- Layer settings: checkerboard or solid black background, **Mask view toggle (B/W or Colour)** using the layer tint, layer colour picker, reset/apply buttons.
- Mask editor features: zoom/pan, undo/redo history, onion-skin overlays, export mask (with optional alpha), fit/zoom 100%, view-state persistence via URL `leo` param across reloads & layer switches.

### Theme Panel
Edit marker sprite, label, and stem colours for normal/hover/focus states. Reset helpers and stem shape selection.

### Locations Panel
List, pick-on-map, drag/drop icon assets, toggle label borders, rename/delete, and camera snapshot controls.

### Settings Panel
Placeholder for local/editor preferences (expand as needed).

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

---

Future updates: integrate layer asset uploads, more brush types/noise, custom brush presets, and GIF/Video captures for documentation via Playwright traces + ffmpeg.
