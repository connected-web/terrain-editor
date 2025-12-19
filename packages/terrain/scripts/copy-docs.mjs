import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..', '..')
const sourceDoc = join(repoRoot, 'documentation', 'WYN-FILE-FORMAT.md')
const sourceSchemas = join(repoRoot, 'documentation', 'schemas')
const targetRoot = join(__dirname, '..', 'documentation')
const targetSchemas = join(targetRoot, 'schemas')

mkdirSync(targetSchemas, { recursive: true })
cpSync(sourceDoc, join(targetRoot, 'WYN-FILE-FORMAT.md'), { force: true })
cpSync(sourceSchemas, targetSchemas, { recursive: true, force: true })
