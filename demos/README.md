## Demos

- `viewer-ts/`: Vanilla Vite + TypeScript harness that boots the shared `initTerrainViewer` with assets fetched from hosted `.wyn` archives. Acts as the smoke-test for runtime loading.
- `viewer-vue3/`: Vue wrapper that embeds the viewer component and exercises reactive controls.
- `../editor/`: Primary editor workspace for importing Wyn archives, editing JSON, and previewing results.

Dev server ports:

- Viewer (TS): `http://localhost:4173/viewer-js/`
- Viewer (Vue): `http://localhost:4174/viewer-vue3/`
- Editor: `http://localhost:4175/editor/`

Keep the relevant servers running when you need to click between them—Vite proxies `/viewer-js`, `/viewer-vue3`, and `/editor` so those URLs work everywhere.
