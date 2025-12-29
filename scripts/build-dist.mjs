import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

function run(command) {
  execSync(command, { stdio: 'inherit', cwd: repoRoot })
}

const distDir = join(repoRoot, 'dist')

const demos = [
  { dir: 'demos/viewer-ts', target: 'viewer-js' },
  { dir: 'editor', target: 'editor' }
]

run('node ./scripts/sync-version.mjs')
run('npm run build:lib')

demos.forEach((demo) => {
  run(`npm --prefix ${demo.dir} run build`)
})

run('npm --prefix website run build')

rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

cpSync(join(repoRoot, 'website/dist'), distDir, { recursive: true })

demos.forEach((demo) => {
  cpSync(join(repoRoot, demo.dir, 'dist'), join(distDir, demo.target), { recursive: true })
})

const mapsDir = join(distDir, 'maps')
mkdirSync(mapsDir, { recursive: true })

const publicMapsDir = join(repoRoot, 'public', 'maps')
try {
  cpSync(publicMapsDir, mapsDir, { recursive: true })
} catch (err) {
  // Ignore missing public maps in environments without local samples.
}

const sourceMapsDir = join(repoRoot, 'maps')
readdirSync(sourceMapsDir)
  .filter((entry) => entry.endsWith('.wyn'))
  .forEach((entry) => {
    cpSync(join(sourceMapsDir, entry), join(mapsDir, entry))
  })
