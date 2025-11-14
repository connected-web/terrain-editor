import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

const run = (command) => {
  execSync(command, { stdio: 'inherit', cwd: repoRoot })
}

const distDir = join(repoRoot, 'dist')
run('npm --prefix packages/viewer run build')

rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

cpSync(join(repoRoot, 'packages/viewer/dist'), join(distDir, 'viewer-js'), {
  recursive: true
})

const mapsDir = join(distDir, 'maps')
mkdirSync(mapsDir, { recursive: true })
cpSync(join(repoRoot, 'maps/wynnal-terrain.wyn'), join(mapsDir, 'wynnal-terrain.wyn'))

const landingHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Terrain Editor</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #05070d; color: #f2ede0; display:flex; align-items:center;
             justify-content:center; min-height:100vh; margin:0; padding:2rem; text-align:center; }
      a { color: #dfc387; font-weight: 600; }
    </style>
  </head>
  <body>
    <div>
      <h1>Terrain Editor Experiments</h1>
      <p>Visit the <a href="./viewer-js/">Vanilla Viewer demo</a> to load Wyn files directly in your browser.</p>
    </div>
  </body>
</html>
`
writeFileSync(join(distDir, 'index.html'), landingHtml, 'utf-8')
