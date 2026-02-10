import json
import math
import os
import re
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
import geopandas as gpd
from shapely.geometry import LineString, mapping, box
from shapely.ops import unary_union
import rasterio
from rasterio.merge import merge
from rasterio.features import rasterize
from affine import Affine
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "scripts" / "data"
MAP_DIR = ROOT / "maps" / "north-america"
LAYERS_DIR = MAP_DIR / "layers"
ICONS_DIR = MAP_DIR / "icons"
THUMB_DIR = MAP_DIR / "thumbnails"

WIDTH = 4096
HEIGHT = 4096

# Bounding box for North America (US + Canada)
MIN_LON = -168.0
MAX_LON = -52.0
MIN_LAT = 14.0
MAX_LAT = 72.0

COUNTRIES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"
STATES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"
PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson"
US_HIGHPOINTS_URL = "https://en.wikipedia.org/wiki/List_of_U.S._states_and_territories_by_elevation"
CA_HIGHPOINTS_URL = "https://en.wikipedia.org/wiki/List_of_highest_points_of_Canadian_provinces_and_territories"
ETOPO1_BED_GEO_URL = "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO1/data/bedrock/grid_registered/georeferenced_tiff/ETOPO1_Bed_g_geotiff.zip"


def download(url: str, dest: Path):
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    import urllib.request

    with urllib.request.urlopen(url) as resp:
        data = resp.read()
    dest.write_bytes(data)


def download_opentopo_tile(demtype: str, dest: Path, west: float, east: float, south: float, north: float):
    if dest.exists():
        try:
            if dest.stat().st_size < 1024:
                dest.unlink()
            else:
                with rasterio.open(dest):
                    return
        except Exception:
            dest.unlink()
    api_key = os.environ.get("OPENTOPO_KEY")
    if not api_key:
        raise RuntimeError("OPENTOPO_KEY is required to download OpenTopography DEMs.")
    url = (
        "https://portal.opentopography.org/API/globaldem"
        f"?demtype={demtype}"
        f"&south={south}&north={north}&west={west}&east={east}"
        "&outputFormat=GTiff"
        f"&API_Key={api_key}"
    )
    download(url, dest)


def download_etopo1_bedrock() -> Path:
    zip_path = DATA_DIR / "ETOPO1_Bed_g_geotiff.zip"
    tif_path = DATA_DIR / "ETOPO1_Bed_g_geotiff.tif"
    if tif_path.exists():
        return tif_path
    download(ETOPO1_BED_GEO_URL, zip_path)
    import zipfile

    with zipfile.ZipFile(zip_path, "r") as zf:
        tif_names = [name for name in zf.namelist() if name.lower().endswith('.tif')]
        if not tif_names:
            raise RuntimeError("ETOPO1 zip does not contain a TIFF")
        name = tif_names[0]
        zf.extract(name, DATA_DIR)
        extracted = DATA_DIR / name
        extracted.replace(tif_path)
    return tif_path


def build_tiles(bounds, step_lon: float, step_lat: float):
    west, south, east, north = bounds
    tiles = []
    lon = west
    while lon < east - 1e-6:
        next_lon = min(lon + step_lon, east)
        lat = south
        while lat < north - 1e-6:
            next_lat = min(lat + step_lat, north)
            tiles.append((lon, next_lon, lat, next_lat))
            lat = next_lat
        lon = next_lon
    return tiles


def load_dem_mosaic(demtype: str):
    tiles_dir = DATA_DIR / f"na_{demtype.lower()}_tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    # Tile the request to avoid OpenTopography request size limits.
    step_lon = 10.0
    step_lat = 10.0
    tiles = build_tiles((MIN_LON, MIN_LAT, MAX_LON, MAX_LAT), step_lon=step_lon, step_lat=step_lat)
    paths = []
    for idx, (west, east, south, north) in enumerate(tiles):
        tile_path = tiles_dir / f"{demtype.lower()}_{idx:02d}.tif"
        download_opentopo_tile(demtype, tile_path, west, east, south, north)
        paths.append(tile_path)

    sources = [rasterio.open(p) for p in paths]
    mosaic, out_transform = merge(sources, nodata=None)
    out_crs = sources[0].crs
    for src in sources:
        src.close()
    return mosaic[0], out_transform, out_crs


def raster_transform():
    return Affine.translation(MIN_LON, MAX_LAT) * Affine.scale(
        (MAX_LON - MIN_LON) / WIDTH, -(MAX_LAT - MIN_LAT) / HEIGHT
    )


def target_transform():
    return rasterio.transform.from_bounds(MIN_LON, MIN_LAT, MAX_LON, MAX_LAT, WIDTH, HEIGHT)


def reproject_to_grid(src_array, src_transform, src_crs) -> np.ndarray:
    dst = np.full((HEIGHT, WIDTH), np.nan, dtype="float32")
    rasterio.warp.reproject(
        source=src_array,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=target_transform(),
        dst_crs="EPSG:4326",
        resampling=rasterio.warp.Resampling.bilinear,
    )
    return dst


def rasterize_geom(geom, default_value=255):
    return rasterize(
        [(geom, default_value)],
        out_shape=(HEIGHT, WIDTH),
        transform=raster_transform(),
        fill=0,
        dtype="uint8",
    )


def save_mask(array: np.ndarray, path: Path):
    Image.fromarray(array, mode="L").save(path)


def ensure_dirs():
    MAP_DIR.mkdir(parents=True, exist_ok=True)
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    if not ICONS_DIR.exists():
        source_icons = ROOT / "maps" / "wynnal" / "icons"
        if source_icons.exists():
            import shutil

            shutil.copytree(source_icons, ICONS_DIR)


def load_geojson():
    countries_path = DATA_DIR / "ne_10m_admin_0_countries.geojson"
    states_path = DATA_DIR / "ne_10m_admin_1_states_provinces.geojson"
    places_path = DATA_DIR / "ne_10m_populated_places.geojson"
    download(COUNTRIES_URL, countries_path)
    download(STATES_URL, states_path)
    download(PLACES_URL, places_path)
    countries = gpd.read_file(countries_path)
    states = gpd.read_file(states_path)
    places = gpd.read_file(places_path)
    return countries, states, places


def clip_to_bounds(gdf):
    bounds = box(MIN_LON, MIN_LAT, MAX_LON, MAX_LAT)
    return gdf[gdf.geometry.intersects(bounds)].copy()


def normalize_name(name: str):
    cleaned = (
        unicodedata.normalize("NFKD", name)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return (
        cleaned.replace("&", "and")
        .replace("'", "")
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )


def parse_decimal_coords(text: str):
    if not text:
        return None
    matches = re.findall(r"-?\d+\.\d+", text)
    if len(matches) < 2:
        return None
    lat = float(matches[-2])
    lon = float(matches[-1])
    if "S" in text:
        lat = -abs(lat)
    if "W" in text:
        lon = -abs(lon)
    return lat, lon


def _read_html_with_headers(url: str):
    from urllib.request import Request, urlopen

    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req) as resp:
        html = resp.read()
    return pd.read_html(html)


def load_us_highpoints():
    tables = _read_html_with_headers(US_HIGHPOINTS_URL)
    # First table includes states/territories; find the one with "High point coordinates"
    table = None
    for t in tables:
        cols = [str(c).lower() for c in t.columns]
        if any("high point coordinates" in c for c in cols):
            table = t
            break
    if table is None:
        raise RuntimeError("Unable to find US highpoints table")
    col_state = table.columns[0]
    coord_col = [c for c in table.columns if "High point coordinates" in str(c)][0]
    high_col = [c for c in table.columns if "Highest point" in str(c)][0]

    results = {}
    for _, row in table.iterrows():
        state = re.sub(r"\[.*?\]", "", str(row[col_state])).strip()
        if state in ("District of Columbia", "American Samoa", "Guam", "Northern Mariana Islands", "Puerto Rico", "U.S. Virgin Islands"):
            continue
        coord_text = str(row.get(coord_col, ""))
        coords = parse_decimal_coords(coord_text)
        if not coords:
            continue
        highpoint = re.sub(r"\[.*?\]", "", str(row.get(high_col, ""))).strip()
        results[normalize_name(state)] = {
            "name": highpoint,
            "lat": coords[0],
            "lon": coords[1],
        }
    return results


def load_ca_highpoints():
    tables = _read_html_with_headers(CA_HIGHPOINTS_URL)
    table = tables[0]
    col_region = [c for c in table.columns if "Province" in str(c)][0]
    col_peak = [c for c in table.columns if "Peak" in str(c)][0]
    col_coord = [c for c in table.columns if "Coordinates" in str(c)][0]
    results = {}
    for _, row in table.iterrows():
        region = re.sub(r"\[.*?\]", "", str(row[col_region])).strip()
        coord_text = str(row.get(col_coord, ""))
        coords = parse_decimal_coords(coord_text)
        if not coords:
            continue
        peak = re.sub(r"\[.*?\]", "", str(row.get(col_peak, ""))).strip()
        results[normalize_name(region)] = {"name": peak, "lat": coords[0], "lon": coords[1]}
    return results


def generate_heightmap(land_mask: np.ndarray):
    etopo_path = download_etopo1_bedrock()
    with rasterio.open(etopo_path) as src:
        etopo_array = src.read(1)
        etopo_transform = src.transform
        etopo_crs = src.crs or "EPSG:4326"

    land_dem = reproject_to_grid(etopo_array, etopo_transform, etopo_crs)
    bathy_dem = land_dem.copy()

    land = land_mask.astype("float32") / 255.0
    land_elev = np.where(land > 0.5, land_dem, np.nan)
    max_land = np.nanmax(land_elev)
    max_land = max_land if np.isfinite(max_land) else 1.0

    water_depth = np.where(land > 0.5, np.nan, -bathy_dem)
    max_depth = np.nanmax(water_depth)
    max_depth = max_depth if np.isfinite(max_depth) else 1.0

    shore = 0.2
    land_scaled = shore + 0.8 * np.clip(land_elev / max_land, 0, 1)
    water_scaled = shore * (1 - np.clip(water_depth / max_depth, 0, 1))

    height = np.where(land > 0.5, land_scaled, water_scaled)
    height = np.nan_to_num(height, nan=0.0)
    height_img = Image.fromarray((height * 255).astype("uint8"), mode="L")
    height_img = height_img.filter(ImageFilter.GaussianBlur(radius=2))
    heightmap = np.array(height_img).astype("uint8")
    return heightmap, shore


def build_mountain_mask():
    ranges = [
        LineString([(-150, 62), (-140, 60), (-130, 58)]),  # Alaska Range
        LineString([(-149, 69), (-141, 68), (-132, 67)]),  # Brooks Range
        LineString([(-125, 49), (-122, 47), (-121, 44), (-120, 41)]),  # Cascades
        LineString([(-123.5, 47), (-121, 44), (-119, 41), (-118, 37)]),  # Sierra Nevada
        LineString([(-121, 55), (-114, 51), (-110, 46), (-107, 43), (-105, 39)]),  # Rockies
        LineString([(-92, 47), (-89, 43), (-86, 39), (-82, 36), (-79, 34), (-76, 33)]),  # Appalachians
    ]
    buffered = [line.buffer(2.2) for line in ranges]
    geom = unary_union(buffered)
    return rasterize_geom(geom)


def build_biomes(land_mask: np.ndarray):
    lat = np.linspace(MAX_LAT, MIN_LAT, HEIGHT)[:, None]
    lon = np.linspace(MIN_LON, MAX_LON, WIDTH)[None, :]

    tundra = (lat >= 60).astype("uint8")
    taiga = ((lat >= 50) & (lat < 60)).astype("uint8")
    desert = ((lat < 37) & (lon < -110)).astype("uint8")
    plains = ((lat >= 37) & (lat < 50) & (lon >= -110) & (lon < -95)).astype("uint8")
    forest = np.ones_like(tundra)

    masks = {
        "tundra": tundra,
        "taiga": taiga,
        "desert": desert,
        "plains": plains,
        "forest": forest,
    }

    biome_masks = {}
    land = land_mask.astype("uint8")
    assigned = np.zeros_like(land)
    for key, mask in masks.items():
        masked = (mask & (land > 0) & (assigned == 0)).astype("uint8")
        assigned = assigned | masked
        biome_masks[key] = (masked * 255).astype("uint8")

    return biome_masks


def build_locations(regions, features, capitals):
    locations = []
    for region in regions:
        name = region["name"]
        code = region["code"]
        point = region["point"]
        capital = capitals.get(code)
        if capital:
            cap_x, cap_y, cap_name = capital
        else:
            cap_x, cap_y, cap_name = point[0], point[1], f"{name} Capital"
        feature = features.get(code, {
            "name": f"{name} Highlands",
            "description": f"Representative geological feature for {name}.",
            "pixel": point,
        })

        region_id = f"loc-na-{code.lower()}"
        locations.append(
            {
                "id": region_id,
                "name": cap_name,
                "icon": "icons/icon_city.png",
                "pixel": {"x": cap_x, "y": cap_y},
                "showBorder": False,
                "view": {
                    "distance": 2.0 + (abs(hash(code)) % 60) / 100,
                    "polar": 0.65 + (abs(hash(code + "polar")) % 35) / 100,
                    "azimuth": ((abs(hash(code + "azimuth")) % 360) - 180) / 100,
                    "targetPixel": {"x": cap_x, "y": cap_y},
                },
                "description": f"Capital city for {name}.",
            }
        )

        fx = int(min(max(feature["pixel"][0], 0), WIDTH - 1))
        fy = int(min(max(feature["pixel"][1], 0), HEIGHT - 1))
        locations.append(
            {
                "id": f"{region_id}-feature",
                "name": feature["name"],
                "icon": "icons/icon_mountain.png",
                "pixel": {"x": fx, "y": fy},
                "showBorder": False,
                "view": {
                    "distance": 1.7 + (abs(hash(code + "feat")) % 40) / 100,
                    "polar": 0.7 + (abs(hash(code + "feat-polar")) % 30) / 100,
                    "azimuth": ((abs(hash(code + "feat-azimuth")) % 360) - 180) / 100,
                    "targetPixel": {"x": fx, "y": fy},
                },
                "description": feature["description"],
            }
        )

    return locations


def geo_to_pixel(lon: float, lat: float):
    x = int((lon - MIN_LON) / (MAX_LON - MIN_LON) * WIDTH)
    y = int((MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * HEIGHT)
    x = max(0, min(WIDTH - 1, x))
    y = max(0, min(HEIGHT - 1, y))
    return x, y


def main():
    ensure_dirs()
    countries, states, places = load_geojson()

    countries = clip_to_bounds(countries)
    states = clip_to_bounds(states)

    target_countries = countries[countries["NAME_EN"].isin(["United States of America", "Canada"])]
    land_geom = unary_union(target_countries.geometry)

    land_mask = rasterize_geom(land_geom)
    water_mask = (255 - land_mask).astype("uint8")

    mountain_mask = build_mountain_mask()

    save_mask(land_mask, LAYERS_DIR / "land.png")
    save_mask(water_mask, LAYERS_DIR / "water_mask.png")
    save_mask(mountain_mask, LAYERS_DIR / "mountain_ranges_mask.png")

    heightmap, shore = generate_heightmap(land_mask)
    save_mask(heightmap, LAYERS_DIR / "heightmap.png")

    biomes = build_biomes(land_mask)
    for key, mask in biomes.items():
        save_mask(mask, LAYERS_DIR / f"biome_{key}.png")

    # States/provinces
    regions = []
    borders = []
    for _, row in states.iterrows():
        admin = row.get("admin")
        if admin not in ("United States of America", "Canada"):
            continue
        name = row.get("name") or row.get("name_en") or row.get("NAME")
        if not name:
            continue
        if name == "District of Columbia":
            continue
        key = normalize_name(name)
        borders.append(row.geometry.boundary)
        point = row.geometry.representative_point()
        px, py = geo_to_pixel(point.x, point.y)
        regions.append({"name": name, "code": key, "point": (px, py)})

    border_geom = unary_union(borders).buffer(0.15)
    border_mask = rasterize_geom(border_geom)
    save_mask(border_mask, LAYERS_DIR / "state_borders.png")

    capitals = {}
    places_filtered = places[places["ADM0NAME"].isin(["United States of America", "Canada"])].copy()
    for region in regions:
        region_name = region["name"]
        region_key = region["code"]
        region_places = places_filtered[places_filtered["ADM1NAME"] == region_name]
        if region_places.empty:
            continue
        capitals_only = region_places[region_places["FEATURECLA"].isin(["Admin-1 capital", "Admin-0 capital"])]
        candidate = capitals_only
        if candidate.empty:
            candidate = region_places.sort_values("POP_MAX", ascending=False)
        if candidate.empty:
            continue
        row = candidate.iloc[0]
        px, py = geo_to_pixel(row.geometry.x, row.geometry.y)
        capitals[region_key] = (px, py, row.get("NAME") or f"{region_name} Capital")

    us_highpoints = load_us_highpoints()
    ca_highpoints = load_ca_highpoints()

    features = {}
    for region in regions:
        name = region["name"]
        key = region["code"]
        hp = us_highpoints.get(key) or ca_highpoints.get(key)
        if not hp:
            continue
        px, py = geo_to_pixel(hp["lon"], hp["lat"])
        features[key] = {
            "name": hp["name"],
            "description": f"Highest point of {name}.",
            "pixel": (px, py),
        }

    locations = build_locations(regions, features, capitals)

    (MAP_DIR / "legend.json").write_text(
        json.dumps(
            {
                "size": [WIDTH, HEIGHT],
                "sea_level": round(shore, 4),
                "height_scale": 0.08,
                "heightmap": "layers/heightmap.png",
                "topology": "layers/heightmap.png",
                "biomes": {
                    "forest": {
                        "label": "Forest",
                        "mask": "layers/biome_forest.png",
                        "rgb": [34, 98, 60],
                    },
                    "plains": {
                        "label": "Plains",
                        "mask": "layers/biome_plains.png",
                        "rgb": [117, 152, 70],
                    },
                    "desert": {
                        "label": "Desert",
                        "mask": "layers/biome_desert.png",
                        "rgb": [185, 152, 78],
                    },
                    "taiga": {
                        "label": "Taiga",
                        "mask": "layers/biome_taiga.png",
                        "rgb": [60, 88, 85],
                    },
                    "tundra": {
                        "label": "Tundra",
                        "mask": "layers/biome_tundra.png",
                        "rgb": [126, 162, 170],
                    },
                    "land": {
                        "label": "Land",
                        "mask": "layers/land.png",
                        "rgb": [66, 120, 86],
                    },
                },
                "overlays": {
                    "water": {
                        "mask": "layers/water_mask.png",
                        "rgb": [34, 92, 124],
                        "label": "Water",
                    },
                    "mountain_ranges": {
                        "mask": "layers/mountain_ranges_mask.png",
                        "rgb": [120, 96, 88],
                        "label": "Mountain Ranges",
                    },
                    "state_borders": {
                        "mask": "layers/state_borders.png",
                        "rgb": [180, 180, 180],
                        "label": "State & Province Borders",
                    },
                },
            }
        )
    )

    (MAP_DIR / "locations.json").write_text(json.dumps(locations))

    (MAP_DIR / "metadata.json").write_text(
        json.dumps(
            {
                "label": "North America (2026-02-08 16:10)",
                "author": "Connected Web",
                "source": "generated",
                "description": "Synthetic North America sample built from Natural Earth boundaries, procedural terrain, and state/province borders.",
            }
        )
    )

    # theme
    theme_source = ROOT / "maps" / "wynnal" / "theme.json"
    if theme_source.exists():
        (MAP_DIR / "theme.json").write_text(theme_source.read_text())

    # thumbnail from land mask
    thumb = Image.fromarray(land_mask, mode="L").resize((512, 512))
    thumb = thumb.convert("RGB")
    thumb.save(THUMB_DIR / "thumbnail.png")

    readme = MAP_DIR / "README.md"
    readme.write_text(
        "# North America Sample Map\n\n"
        "Synthetic 4096x4096 terrain built from Natural Earth boundaries.\n"
        "Biomes and mountain ranges are procedurally generated for editor testing.\n"
        "State/province overlays and locations are generated from admin boundaries; "
        "geological feature markers are representative placeholders for now.\n"
    )


if __name__ == "__main__":
    main()
