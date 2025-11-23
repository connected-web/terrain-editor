import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const repoRoot = join(__dirname, '..', '..')
const source = join(repoRoot, 'maps', 'wynnal-terrain.wyn')
const targetDir = join(repoRoot, 'public', 'maps')
const target = join(targetDir, 'wynnal-terrain.wyn')

mkdirSync(targetDir, { recursive: true })
cpSync(source, target)
