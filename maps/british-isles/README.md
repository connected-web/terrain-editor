# British Isles Map Data

This map was regenerated from public datasets to give defensible borders, a more top-down projection, and consistent heightmap scaling for both land and sea.

## Sources

- OpenTopography SRTMGL3 DEM (land elevation)
  - https://portal.opentopography.org/
- OpenTopography SRTM15Plus (bathymetry + global topo)
  - https://portal.opentopography.org/
- Natural Earth 1:50m land polygons (ne_50m_land) for land/water masks
  - https://www.naturalearthdata.com/
- GADM 4.1 administrative boundaries
  - United Kingdom (GADM v4.1, level 0 + level 1)
  - Ireland (GADM v4.1, level 0)
  - https://gadm.org/

## Projection + Bounds

- Projection: Azimuthal Equidistant (WGS84), centered on the UK
  - `+proj=aeqd +lat_0=54 +lon_0=-2 +datum=WGS84 +units=m +no_defs`
- Geographic bounds before projection: lon -11.0..2.5, lat 49.0..61.5
- Output size: 1024x1536 (legend pixel space)

## Heightmap Scaling

- Shoreline is anchored at 20% gray.
- Land scales up from shoreline to 100% white at the highest UK peak.
- Water scales down from shoreline to 0% black at the deepest local bathymetry.

Formulas:

- Land: `0.2 + 0.8 * clamp(elev_m / max_land_m, 0, 1)`
- Water: `0.2 * (1 - clamp(depth_m / min_depth_m, 0, 1))`

Current sea level (`legend.json`): `0.1365`.

## Projection Mapping Details (for relocating locations)

This map uses an explicit projected bounding box to map lon/lat to pixels. The pipeline used to derive the projected extent is:

- Project the geographic bounds (lon -11.0..2.5, lat 49.0..61.5) into AEQD.
- Sample the boundary grid (60 points along each edge) to capture the max extent after projection.
- Compute projected bbox:
  - `x_min = min(sampled_x)`, `x_max = max(sampled_x)`
  - `y_min = min(sampled_y)`, `y_max = max(sampled_y)`
- Build the affine transform for the 1024x1536 canvas:
  - `transform = from_bounds(x_min, y_min, x_max, y_max, width=1024, height=1536)`
- Sampled AEQD bounds (meters) from the 60-point edge sweep:
  - `x_min = -657715.3360`, `x_max = 329482.2298`
  - `y_min = -556285.4508`, `y_max = 866776.9170`

Pixel orientation:

- Pixel (0,0) is the top-left of the canvas.
- X increases to the right, Y increases downward.
- Rasterio's `from_bounds` creates a north-up transform (negative Y pixel size).

If you need to compute new pixel locations from lon/lat, use the same AEQD projection and the `x_min/x_max/y_min/y_max` derived from the sampled bounds above to build the same affine transform, then map projected coordinates into pixel space.

## Location Coordinate Sources

Standard lon/lat coordinates were sourced via Nominatim (OpenStreetMap) searches on 2026-01-03, then projected into AEQD and mapped into the 1024x1536 pixel space using the transform above.

| Location | Query | Lon | Lat | Source |
| --- | --- | --- | --- | --- |
| London | London, England, UK | -0.127765 | 51.507446 | Nominatim (OSM) |
| Edinburgh | Edinburgh, Scotland, UK | -3.188375 | 55.953346 | Nominatim (OSM) |
| Glasgow | Glasgow, Scotland, UK | -4.250169 | 55.861155 | Nominatim (OSM) |
| Dublin | Dublin, Ireland | -6.260559 | 53.349379 | Nominatim (OSM) |
| Belfast | Belfast, Northern Ireland, UK | -5.927710 | 54.597580 | Nominatim (OSM) |
| Cardiff | Cardiff, Wales, UK | -3.179193 | 51.481655 | Nominatim (OSM) |
| Manchester | Manchester, England, UK | -2.245115 | 53.479489 | Nominatim (OSM) |
| Birmingham | Birmingham, England, UK | -1.902691 | 52.479699 | Nominatim (OSM) |
| Liverpool | Liverpool, England, UK | -2.991680 | 53.407199 | Nominatim (OSM) |
| Bristol | Bristol, England, UK | -2.597298 | 51.453802 | Nominatim (OSM) |
| Newcastle | Newcastle upon Tyne, England, UK | -1.613157 | 54.973847 | Nominatim (OSM) |
| Leeds | Leeds, England, UK | -1.543794 | 53.797418 | Nominatim (OSM) |
| Ben Nevis | Ben Nevis, Scotland, UK | -5.003526 | 56.796858 | Nominatim (OSM) |
| Cairn Gorm | Cairn Gorm, Scotland, UK | -3.644486 | 57.116769 | Nominatim (OSM) |
| Yr Wyddfa | Yr Wyddfa (Snowdon), Wales, UK | -4.130588 | 52.926542 | Nominatim (OSM) |
| Scafell Pike | Scafell Pike, England, UK | -3.211654 | 54.454259 | Nominatim (OSM) |
| Slieve Donard | Slieve Donard, Northern Ireland, UK | -5.920961 | 54.180222 | Nominatim (OSM) |
| England | England, UK | -1.264906 | 52.531021 | Nominatim (OSM) |
| Scotland | Scotland, UK | -4.114052 | 56.786111 | Nominatim (OSM) |
| Wales | Wales, UK | -3.738930 | 52.292812 | Nominatim (OSM) |
| Ireland | Ireland | -7.979460 | 52.865196 | Nominatim (OSM) |
| Northern Ireland | GADM v4.1 (GBR level 1 centroid) | -6.692771 | 54.609304 | GADM v4.1 |

## Generated Files

- `layers/heightmap.png` combined from SRTMGL3 (land) and SRTM15Plus (sea)
- `layers/land.png` from Natural Earth land polygons, rasterized in AEQD
- `layers/water_mask.png` is the inverse of `land.png`
- `layers/wales_mask.png`, `layers/england_mask.png`, `layers/scotland_mask.png`, `layers/ireland_mask.png`
  - `layers/northern_ireland_mask.png`
  - From GADM borders, rasterized in AEQD and clipped to land
  - Opacity baked into mask values:
    - Wales 75%
    - England 50%
    - Scotland 60%
    - Ireland 70%
    - Northern Ireland 70%

## Location Markers

- Country markers are placed at the centroid of each country mask.
- Existing city/mountain markers remain scaled for the 1024x1536 canvas.
- All location markers currently have `showBorder: false` in `locations.json`.

## Commands Used

Download datasets (OpenTopography):

```
curl -L -o tmp/ne/uk_dem.tif "https://portal.opentopography.org/API/globaldem?demtype=SRTMGL3&south=49&north=61.5&west=-11&east=2.5&outputFormat=GTiff&API_Key=$OPENTOPO_KEY"
curl -L -o tmp/ne/uk_bathy.tif "https://portal.opentopography.org/API/globaldem?demtype=SRTM15Plus&south=49&north=61.5&west=-11&east=2.5&outputFormat=GTiff&API_Key=$OPENTOPO_KEY"
```

Repack the map:

```
cd maps/british-isles && zip -r ../british-isles-terrain.wyn legend.json locations.json theme.json metadata.json icons/ layers/ thumbnails/ README.md
```

## API Key Notes

- OpenTopography requires an API key for downloads.
- Set it in your shell as `OPENTOPO_KEY` and use it in the download URLs.
- Do not commit API keys to the repo.
