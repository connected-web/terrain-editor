import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

const run = (command) => {
  execSync(command, { stdio: 'inherit', cwd: repoRoot })
}

const distDir = join(repoRoot, 'dist')

const demos = [
  { dir: 'demos/viewer-ts', target: 'viewer-js' },
  { dir: 'demos/viewer-vue3', target: 'viewer-vue3' },
  { dir: 'demos/editor-vue3', target: 'editor-vue3' }
]

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
cpSync(join(repoRoot, 'maps/wynnal-terrain.wyn'), join(mapsDir, 'wynnal-terrain.wyn'))
