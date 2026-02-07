import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const mapDir = path.join(repoRoot, 'maps', 'british-isles')
const metadataPath = path.join(mapDir, 'metadata.json')
const outFile = path.join(repoRoot, 'maps', 'british-isles-terrain.wyn')

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

async function updateMetadataLabel() {
  const raw = await fs.readFile(metadataPath, 'utf8')
  const metadata = JSON.parse(raw)
  const baseLabel = typeof metadata.label === 'string'
    ? metadata.label.replace(/\s*\(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\)\s*/g, '').trim()
    : 'British Isles'
  metadata.label = `${baseLabel} (${formatTimestamp()})`
  await fs.writeFile(metadataPath, JSON.stringify(metadata))
  return metadata.label
}

async function pack() {
  const label = await updateMetadataLabel()
  const args = [
    '-r',
    outFile,
    'legend.json',
    'locations.json',
    'theme.json',
    'metadata.json',
    'icons/',
    'layers/',
    'thumbnails/'
  ]
  await execFileAsync('zip', args, { cwd: mapDir })
  console.log(`Packed british-isles-terrain.wyn with label: ${label}`)
}

pack().catch((err) => {
  console.error('Failed to pack british-isles map:', err)
  process.exit(1)
})
