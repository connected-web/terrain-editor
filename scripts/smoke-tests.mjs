import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { promises as fs, readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.join(path.dirname(__filename), '..')
const distDir = path.join(repoRoot, 'dist')
const serverPort = 0 // let OS pick available port
const endpoints = ['/', '/viewer-js/', '/editor/', '/maps/wynnal-terrain.wyn']

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

async function serveFile(filePath) {
  const data = await fs.readFile(filePath)
  const ext = path.extname(filePath)
  const type = mimeTypes[ext] || 'application/octet-stream'
  return { data, type }
}

async function startServer() {
  const server = createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400
      res.end('Bad request')
      return
    }
    const url = new URL(req.url, 'http://localhost')
    const resolved = path.join(distDir, decodeURIComponent(url.pathname))
    let filePath = resolved
    try {
      const stat = await fs.stat(filePath)
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }
      const { data, type } = await serveFile(filePath)
      res.setHeader('Content-Type', type)
      res.end(data)
    } catch (err) {
      res.statusCode = 404
      res.end('Not found')
    }
  })

  await new Promise((resolve) => server.listen({ port: serverPort, host: '127.0.0.1' }, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Failed to determine server port')
  return { server, port: address.port }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function getShortVersion() {
  const pkgPath = path.join(repoRoot, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return String(pkg.version).split('.').slice(0, 2).join('.')
}

const version = getShortVersion()

const CONTENT_CHECKS = new Map([
  ['/', '<title>Terrain Editor - Connected Web</title>'],
  ['/viewer-js/', `Terrain Viewer (${version}) Demo`],
  ['/editor/', `Terrain Editor ${version}`],
  ['/maps/wynnal-terrain.wyn', 'PK']
])

async function fetchWithRetry(url, retries = 5, expectedText) {
  let attempt = 0
  while (attempt < retries) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (expectedText) {
        const body = await response.text()
        if (!body.includes(expectedText)) {
          throw new Error(`Unexpected response for ${url}: missing marker "${expectedText}"`)
        }
      }
      return
    } catch (err) {
      attempt += 1
      if (attempt >= retries) throw err
      await wait(300)
    }
  }
}

async function run() {
  await runCommand('npm', ['run', 'build'])
  const { server, port } = await startServer()

  try {
    for (const endpoint of endpoints) {
      const url = `http://127.0.0.1:${port}${endpoint}`
      console.log(`Checking ${url}`)
      await fetchWithRetry(url, 5, CONTENT_CHECKS.get(endpoint))
    }
    console.log('Smoke tests completed successfully.')
  } finally {
    server.close()
    await once(server, 'close')
  }
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
