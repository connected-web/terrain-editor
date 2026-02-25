import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.join(path.dirname(__filename), '..')
const packagePath = path.join(repoRoot, 'package.json')
const releaseUrl = 'https://api.github.com/repos/connected-web/terrain-editor/releases/latest'

function readPackageJson() {
  return JSON.parse(readFileSync(packagePath, 'utf8'))
}

function writePackageJson(next) {
  writeFileSync(packagePath, `${JSON.stringify(next, null, 2)}\n`)
}

function normalizeTag(tagName) {
  if (!tagName) return null
  const trimmed = String(tagName).trim()
  const version = trimmed.replace(/^v/i, '')
  return /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version) ? version : null
}

async function fetchLatestVersion() {
  try {
    const ghVersion = execSync(
      'gh api repos/connected-web/terrain-editor/releases/latest --jq .tag_name',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
    const ghNormalized = normalizeTag(ghVersion)
    if (ghNormalized) return ghNormalized
  } catch (err) {
    // Fall back to fetch when gh is unavailable.
  }

  try {
    const token = process.env.GITHUB_TOKEN
    const response = await fetch(releaseUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'terrain-editor-build',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    if (!response.ok) {
      console.warn(`[sync-version] Failed to fetch release: ${response.status}`)
      return null
    }
    const data = await response.json()
    const version = normalizeTag(data.tag_name)
    if (!version) {
      console.warn('[sync-version] Release tag missing or not a semver string.')
      return null
    }
    return version
  } catch (err) {
    console.warn('[sync-version] Skipping remote version sync (network error).')
    return null
  }
}

async function run() {
  if (!process.env.CI) {
    console.log('[sync-version] Skipping remote version sync outside CI.')
    return
  }
  if (process.env.CI && process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/main') {
    console.log('[sync-version] Skipping version sync on non-main CI refs.')
    return
  }
  if (process.env.SKIP_VERSION_SYNC === 'true') {
    console.log('[sync-version] Skipping version sync (SKIP_VERSION_SYNC=true).')
    return
  }
  const latest = await fetchLatestVersion()
  if (!latest) return

  const pkg = readPackageJson()
  if (pkg.version === latest) {
    console.log(`[sync-version] package.json already at ${latest}`)
    return
  }

  pkg.version = latest
  writePackageJson(pkg)
  console.log(`[sync-version] Updated package.json to ${latest}`)
}

run()
