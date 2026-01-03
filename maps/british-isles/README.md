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

Pixel orientation:

- Pixel (0,0) is the top-left of the canvas.
- X increases to the right, Y increases downward.
- Rasterio's `from_bounds` creates a north-up transform (negative Y pixel size).

If you need to compute new pixel locations from lon/lat, use the same AEQD projection and the `x_min/x_max/y_min/y_max` derived from the sampled bounds above to build the same affine transform, then map projected coordinates into pixel space.

## Generated Files

- `layers/heightmap.png` combined from SRTMGL3 (land) and SRTM15Plus (sea)
- `layers/land.png` from Natural Earth land polygons, rasterized in AEQD
- `layers/water_mask.png` is the inverse of `land.png`
- `layers/wales_mask.png`, `layers/england_mask.png`, `layers/scotland_mask.png`, `layers/ireland_mask.png`
  - From GADM borders, rasterized in AEQD and clipped to land
  - Opacity baked into mask values:
    - Wales 75%
    - England 50%
    - Scotland 60%
    - Ireland 70%

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
