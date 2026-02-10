import os
import re
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
module_path = ROOT / "scripts" / "build-north-america-map.py"
loader = SourceFileLoader("na_builder", str(module_path))
na_builder = loader.load_module()

DATA_DIR = na_builder.DATA_DIR
MIN_LON = na_builder.MIN_LON
MAX_LON = na_builder.MAX_LON
MIN_LAT = na_builder.MIN_LAT
MAX_LAT = na_builder.MAX_LAT
SRTMGL3 = getattr(na_builder, "SRTMGL3", None)
SRTM15PLUS = getattr(na_builder, "SRTM15PLUS", None)
build_tiles = na_builder.build_tiles
download_opentopo_tile = na_builder.download_opentopo_tile


def ensure_key():
    if os.environ.get('OPENTOPO_KEY'):
        return
    bashrc = Path('/home/markavian/.bashrc')
    if bashrc.exists():
        text = bashrc.read_text()
        m = re.search(r'export\s+OPENTOPO_KEY\s*=\s*"([^"]+)"', text)
        if m:
            os.environ['OPENTOPO_KEY'] = m.group(1)


def download_set(demtype: str, step_lon: float = 10.0, step_lat: float = 10.0):
    tiles_dir = DATA_DIR / f"na_{demtype.lower()}_tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    tiles = build_tiles((MIN_LON, MIN_LAT, MAX_LON, MAX_LAT), step_lon=step_lon, step_lat=step_lat)
    for idx, (west, east, south, north) in enumerate(tiles):
        tile_path = tiles_dir / f"{demtype.lower()}_{idx:02d}.tif"
        download_opentopo_tile(demtype, tile_path, west, east, south, north)


if __name__ == '__main__':
    ensure_key()
    if SRTMGL3:
        download_set(SRTMGL3)
    if SRTM15PLUS:
        download_set(SRTM15PLUS)
    if not SRTMGL3 and not SRTM15PLUS:
        print("No OpenTopography DEMs configured; using ETOPO1 instead.")
