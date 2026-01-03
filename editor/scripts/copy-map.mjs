import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const repoRoot = join(__dirname, '..', '..')
const targetDir = join(repoRoot, 'public', 'maps')
const registryPath = join(targetDir, 'registry.json')

mkdirSync(targetDir, { recursive: true })

const registryRaw = readFileSync(registryPath, 'utf8')
const registry = JSON.parse(registryRaw)
const maps = Array.isArray(registry?.maps) ? registry.maps : []

for (const entry of maps) {
  if (!entry || entry.status !== 'available' || !entry.filename) continue
  const source = join(repoRoot, 'maps', entry.filename)
  if (!existsSync(source)) continue
  const target = join(targetDir, entry.filename)
  cpSync(source, target)
}
