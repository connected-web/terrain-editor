# WYN File Format

## Overview

`.wyn` files are ZIP archives containing terrain data, layer masks, and optional metadata used by
`@connected-web/terrain-editor`. The loader expects JSON descriptors plus referenced PNG assets.
All asset paths are relative to the archive root.

## Archive Layout

Required:

```
legend.json
```

Common (referenced by `legend.json`):

```
layers/
icons/
```

Optional:

```
locations.json
theme.json
metadata.json
thumbnails/
```

The archive can include any additional assets as long as paths match the JSON references.

## legend.json (required)

Describes terrain dimensions, height/topology maps, and per-layer masks.

Schema: `schemas/legend.schema.json`

```json
{
  "size": [1024, 1536],
  "sea_level": 0.35,
  "heightmap": "layers/heightmap.png",
  "topology": "layers/topology.png",
  "biomes": {
    "forest": { "mask": "layers/forest_mask.png", "rgb": [48, 92, 54], "label": "Forest" }
  },
  "overlays": {
    "water": { "mask": "layers/water_mask.png", "rgb": [34, 92, 124], "label": "Water" },
    "texture": { "rgba": "layers/atlas-texture.png", "label": "Texture" }
  }
}
```

Schema:

- `size`: `[width, height]` in pixels for the map and mask assets.
- `sea_level`: Optional float in 0-1 heightmap range; used to offset terrain vertically.
- `heightmap`: Path to a PNG. The viewer samples the **red channel** (0-255) as height data.
- `topology`: Optional path to a PNG used for shaded legend/composite rendering. Falls back to
  `heightmap` when omitted.
- `biomes`: Record of biome layers. Keys are layer ids used by the editor/viewer.
- `overlays`: Record of overlay layers. Keys are layer ids used by the editor/viewer.

Each layer entry (biomes + mask-based overlays):

- `mask`: Path to a PNG mask. The viewer converts the max RGB channel into alpha.
- `rgb`: `[r, g, b]` integers (0-255) used to colorize the legend composite.
- `label`: Optional display name in the editor UI.

Overlay texture entries (overlays only):

- `rgba`: Path to a full-color PNG/WebP/etc. The viewer draws the image directly using the
  image alpha channel.
- `label`: Optional display name in the editor UI.

## locations.json (optional)

Array of location markers. Coordinates are expressed in legend pixel space.

Schema: `schemas/locations.schema.json`

```json
[
  {
    "id": "loc-123",
    "name": "Castle",
    "icon": "icons/icon_castle.png",
    "description": "Seat of power.",
    "pixel": { "x": 514, "y": 728 },
    "showBorder": true,
    "view": {
      "distance": 1.82,
      "polar": 0.96,
      "azimuth": 1.87,
      "targetPixel": { "x": 514, "y": 728 }
    }
  }
]
```

Fields:

- `id`: Stable unique id string.
- `name`: Optional label for markers.
- `icon`: Optional icon source. If the value looks like a file path or image filename, the viewer
  loads it as a texture; otherwise the first character is rendered as a glyph.
- `description`: Optional freeform text (ignored by the viewer, preserved by the editor).
- `pixel`: `{ x, y }` in legend pixel space. The viewer converts to UV/world coordinates.
- `showBorder`: Optional boolean for marker label border visibility.
- `view`: Optional camera view state:
  - `distance`: Camera distance from target in world units.
  - `polar`: Polar angle in radians.
  - `azimuth`: Azimuthal angle in radians.
  - `targetPixel`: Optional pixel coordinate to orbit around.

## theme.json (optional)

Overrides for the default terrain marker theme.

Schema: `schemas/theme.schema.json`

```json
{
  "locationMarkers": {
    "sprite": {
      "fontFamily": "\"DM Sans\", sans-serif",
      "fontWeight": "600",
      "maxFontSize": 52,
      "minFontSize": 22,
      "paddingX": 20,
      "paddingY": 10,
      "borderRadius": 4,
      "states": {
        "default": {
          "textColor": "#ffffff",
          "backgroundColor": "rgba(8, 10, 18, 0.78)",
          "borderColor": "rgba(255, 255, 255, 0.35)",
          "borderThickness": 2,
          "opacity": 0.85
        },
        "hover": { "backgroundColor": "#3c49af" },
        "focus": { "backgroundColor": "#cb811a" }
      }
    },
    "stem": {
      "shape": "triangle",
      "radius": 0.02,
      "states": {
        "default": { "color": "#d9c39c", "opacity": 0.2 },
        "focus": { "color": "#c00c0c", "opacity": 0.75 }
      }
    }
  }
}
```

Notes:

- `theme.json` is a partial override; any missing values fall back to the default theme.
- `stem.shape` supports: `cylinder`, `triangle`, `square`, `pentagon`, `hexagon`.

## metadata.json (optional)

Basic project metadata stored by the editor.

Schema: `schemas/metadata.schema.json`

```json
{
  "label": "wynnal-terrain.wyn",
  "author": "J. Markavian",
  "source": "archive"
}
```

Fields:

- `label`: Display name for the project.
- `author`: Optional author string.
- `source`: `archive` or `scratch`.

## Assets and Conventions

- Use PNGs for all image assets. The loader infers mime types by file extension.
- All referenced assets must exist inside the archive.
- The editor stores arbitrary files referenced by the JSON in the ZIP (see `buildWynArchive`).
- `legend.size` should match the pixel dimensions of mask assets.

## Example Archive

```
legend.json
locations.json
theme.json
metadata.json
layers/heightmap.png
layers/topology.png
layers/forest_mask.png
layers/water_mask.png
icons/icon_castle.png
thumbnails/thumbnail.png
```
