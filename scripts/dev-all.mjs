import { execSync, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = join(dirname(__filename), '..')
const PID_FILE = join(repoRoot, '.devservers.json')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const services = [
  { name: 'viewer (TS)', script: ['run', 'dev:viewer'] },
  { name: 'editor', script: ['run', 'dev:editor'] },
  { name: 'website', script: ['run', 'dev:website'] }
]
const portsToClear = [4173, 4175, 4176]

async function killRecordedPids() {
  try {
    const raw = await fs.readFile(PID_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (Array.isArray(data?.pids)) {
      for (const entry of data.pids) {
        const pid = typeof entry.pid === 'number' ? entry.pid : entry
        if (typeof pid !== 'number') continue
        try {
          process.kill(pid, 'SIGTERM')
          console.log(`[dev:all] Terminated leftover PID ${pid}`)
        } catch (err) {
          if (err && err.code !== 'ESRCH') {
            console.warn(`[dev:all] Failed to kill PID ${pid}:`, err.message)
          }
        }
      }
    }
    await fs.unlink(PID_FILE).catch(() => {})
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[dev:all] Failed to read previous PID file:', err.message)
    }
  }
}

function readListeningPids(port) {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim()
    if (!output) return []
    return output
      .split('\n')
      .map((value) => Number.parseInt(value, 10))
      .filter((pid) => Number.isFinite(pid))
  } catch (err) {
    return []
  }
}

function readProcessCwd(pid) {
  try {
    const output = execSync(`lsof -a -p ${pid} -d cwd -Fn`, {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim()
    const lines = output.split('\n')
    const cwdLine = lines.find((line) => line.startsWith('n'))
    return cwdLine ? cwdLine.slice(1) : null
  } catch (err) {
    return null
  }
}

async function killPortConflicts() {
  for (const port of portsToClear) {
    const pids = readListeningPids(port)
    for (const pid of pids) {
      const cwd = readProcessCwd(pid)
      if (!cwd || !cwd.startsWith(repoRoot)) continue
      try {
        process.kill(pid, 'SIGTERM')
        console.log(`[dev:all] Freed port ${port} by stopping PID ${pid} (${cwd})`)
      } catch (err) {
        if (err && err.code !== 'ESRCH') {
          console.warn(`[dev:all] Failed to stop PID ${pid} on port ${port}:`, err.message)
        }
      }
    }
  }
}

const children = []
let shuttingDown = false

async function start() {
  await killRecordedPids()
  await killPortConflicts()

  for (const service of services) {
    const child = spawn(npmCmd, service.script, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env
    })
    console.log(`[dev:all] Started ${service.name} (pid ${child.pid})`)
    children.push({ child, service })
    child.on('exit', (code, signal) => {
      if (shuttingDown) return
      console.error(
        `[dev:all] ${service.name} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`
      )
      shutdown(code ?? 1)
    })
  }

  await fs.writeFile(
    PID_FILE,
    JSON.stringify(
      {
        createdAt: Date.now(),
        pids: children.map(({ child, service }) => ({ name: service.name, pid: child.pid }))
      },
      null,
      2
    )
  )

  const handleSignal = (signal) => {
    console.log(`[dev:all] Caught ${signal}, shutting down...`)
    shutdown(0)
  }
  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
  process.on('exit', () => shutdown(0))
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const { child, service } of children) {
    if (!child.killed) {
      try {
        process.kill(child.pid, 'SIGTERM')
        console.log(`[dev:all] Stopping ${service.name} (pid ${child.pid})`)
      } catch (err) {
        if (err && err.code !== 'ESRCH') {
          console.warn(`[dev:all] Failed to stop ${service.name}:`, err.message)
        }
      }
    }
  }
  fs.unlink(PID_FILE).catch(() => {})
  setTimeout(() => process.exit(code), 300)
}

start().catch((err) => {
  console.error('[dev:all] Failed to start dev servers:', err)
  shutdown(1)
})
