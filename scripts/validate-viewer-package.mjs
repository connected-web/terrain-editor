import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.join(path.dirname(__filename), '..')
const viewerSourceDir = path.join(repoRoot, 'demos/viewer-ts')
const terrainPackageDir = path.join(repoRoot, 'packages/terrain')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`)
  }
  return result
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf-8',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`)
  }
  return result.stdout.trim()
}

function copyViewerProject(destination) {
  cpSync(viewerSourceDir, destination, {
    recursive: true,
    filter: (src) => {
      const relative = path.relative(viewerSourceDir, src)
      if (!relative || relative.startsWith('..')) return true
      const topLevel = relative.split(path.sep)[0]
      if (topLevel === 'node_modules' || topLevel === 'dist') {
        return false
      }
      return true
    }
  })
}

async function main() {
  console.log('Building terrain library…')
  run('npm', ['run', 'build:lib'], { cwd: repoRoot })

  console.log('Packing terrain library tarball…')
  const packDir = mkdtempSync(path.join(tmpdir(), 'terrain-pack-'))
  const tarballName = runCapture('npm', ['pack', '--pack-destination', packDir], {
    cwd: terrainPackageDir
  })
  const tarballPath = path.join(packDir, tarballName)

  console.log('Preparing isolated viewer workspace…')
  const tempDir = mkdtempSync(path.join(tmpdir(), 'terrain-viewer-'))
  const tempViewerDir = path.join(tempDir, 'demos', 'viewer-ts')
  mkdirSync(path.dirname(tempViewerDir), { recursive: true })
  copyViewerProject(tempViewerDir)

  const tempMapsDir = path.join(tempDir, 'maps')
  const sourceMapPath = path.join(repoRoot, 'maps', 'wynnal-terrain.wyn')
  mkdirSync(tempMapsDir, { recursive: true })
  cpSync(sourceMapPath, path.join(tempMapsDir, 'wynnal-terrain.wyn'), {
    recursive: true
  })

  const pkgPath = path.join(tempViewerDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.dependencies = pkg.dependencies || {}
  pkg.dependencies['@connected-web/terrain-editor'] = `file:${tarballPath}`
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

  const lockPath = path.join(tempViewerDir, 'package-lock.json')
  try {
    rmSync(lockPath)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  console.log('Installing viewer dependencies…')
  run('npm', ['install'], { cwd: tempViewerDir, env: { ...process.env } })

  console.log('Building viewer with packaged terrain library…')
  run('npm', ['run', 'build'], {
    cwd: tempViewerDir,
    env: { ...process.env, VIEWER_TS_USE_PACKAGE: 'true' }
  })

  console.log(`Viewer build succeeded (artefacts at ${path.join(tempViewerDir, 'dist')}).`)

  rmSync(tempDir, { recursive: true, force: true })
  rmSync(packDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
