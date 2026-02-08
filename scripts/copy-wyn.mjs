import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const sourceDir = path.join(repoRoot, 'maps')
function resolveTargetDir() {
  const home = os.homedir()
  const winHome = process.env.USERPROFILE
  const wslHome = process.env.WSL_DISTRO_NAME ? process.env.WSLENV : null
  const isWsl = Boolean(process.env.WSL_DISTRO_NAME) || Boolean(process.env.WSL_INTEROP)

  if (isWsl) {
    const windowsHome = winHome ?? 'C:\\\\Users\\\\johnb'
    return path.join(
      '/mnt',
      windowsHome[0].toLowerCase(),
      windowsHome.slice(2).replace(/\\\\/g, '/'),
      'Documents',
      'Ascension',
      'Stories',
      'assets',
      'maps'
    )
  }

  return path.join(
    home,
    'Documents',
    'Ascension',
    'Stories',
    'assets',
    'maps'
  )
}

const targetDir = resolveTargetDir()

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function listWynFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.wyn'))
    .map((entry) => entry.name)
}

async function copyFiles(files, fromDir, toDir) {
  await ensureDir(toDir)
  const copies = files.map(async (file) => {
    const src = path.join(fromDir, file)
    const dest = path.join(toDir, file)
    await fs.copyFile(src, dest)
    return dest
  })
  return Promise.all(copies)
}

async function main() {
  const wynFiles = await listWynFiles(sourceDir)
  if (!wynFiles.length) {
    console.log('No .wyn files found in maps/.')
    return
  }
  const copied = await copyFiles(wynFiles, sourceDir, targetDir)
  console.log(`Copied ${copied.length} file(s) to ${targetDir}`)
  for (const dest of copied) {
    console.log(`- ${dest}`)
  }
}

main().catch((err) => {
  console.error('Failed to copy .wyn files:', err)
  process.exit(1)
})
