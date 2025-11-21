## Demos

- `viewer-ts/`: Vanilla Vite + TypeScript harness that boots the shared `initTerrainViewer` with assets fetched from hosted `.wyn` archives. Acts as the smoke-test for runtime loading.
- `../editor/`: Primary editor workspace for importing Wyn archives, editing JSON, and previewing results.

Dev server ports:

- Viewer: `http://localhost:4173/viewer-js/`
- Editor: `http://localhost:4175/editor/`

Keep the relevant servers running when you need to click between them—links in the website CTA buttons point directly to these ports during development.
