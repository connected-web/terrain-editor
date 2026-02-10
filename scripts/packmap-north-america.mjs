import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(new URL('.', import.meta.url).pathname, '..', '..')
const mapDir = resolve(root, 'maps', 'north-america')
const output = resolve(root, 'maps', 'north-america-terrain.wyn')

execSync(
  `cd "${mapDir}" && zip -r "${output}" legend.json locations.json theme.json metadata.json icons/ layers/ thumbnails/`,
  { stdio: 'inherit' }
)
