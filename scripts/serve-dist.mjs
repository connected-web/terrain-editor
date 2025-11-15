import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.join(path.dirname(__filename), '..')
const distDir = path.join(repoRoot, 'dist')
const port = Number(process.env.PREVIEW_PORT || 4173)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const sendFile = async (filePath, res) => {
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) {
      return sendFile(path.join(filePath, 'index.html'), res)
    }
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
    res.end(data)
  } catch (err) {
    res.statusCode = err.code === 'ENOENT' ? 404 : 500
    res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error')
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const requestedPath = decodeURIComponent(url.pathname)
  const filePath = path.join(distDir, requestedPath)
  sendFile(filePath, res)
})

server.listen(port, () => {
  console.log(`Serving dist/ on http://127.0.0.1:${port}`)
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
