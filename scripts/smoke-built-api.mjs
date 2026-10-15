import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const apiEntry = join(repositoryRoot, 'apps/api/dist/dev-server.js')
const fixtureRoot = await mkdtemp(join(tmpdir(), 'writer-agent-api-smoke-'))
const stateDirectory = join(fixtureRoot, 'state')
const child = spawn(process.execPath, [apiEntry], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    WRITER_AGENT_API_PORT: '0',
    WRITER_AGENT_HARNESS_ROOT: fixtureRoot,
    WRITER_AGENT_STATE_DIR: stateDirectory,
    WRITER_AGENT_PROJECT_ID: 'ci-smoke',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
let startupSettled = false
let resolvePort
let rejectStartup
const portPromise = new Promise((resolvePromise, rejectPromise) => {
  resolvePort = resolvePromise
  rejectStartup = rejectPromise
})
const exitPromise = new Promise((resolveExit) => {
  child.once('exit', (code, signal) => resolveExit({ code, signal }))
})
const startupTimeout = setTimeout(() => {
  if (startupSettled) return
  startupSettled = true
  rejectStartup(new Error(`Built API did not announce a listening port. Output:\n${output}`))
}, 15_000)

child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', (chunk) => {
  output += chunk
  const match = output.match(/Writer Agent API listening on http:\/\/127\.0\.0\.1:(\d+)/)
  if (!startupSettled && match) {
    startupSettled = true
    clearTimeout(startupTimeout)
    resolvePort(Number(match[1]))
  }
})
child.stderr.on('data', (chunk) => { output += chunk })
child.once('error', (error) => {
  if (startupSettled) return
  startupSettled = true
  clearTimeout(startupTimeout)
  rejectStartup(error)
})
child.once('exit', (code, signal) => {
  if (startupSettled) return
  startupSettled = true
  clearTimeout(startupTimeout)
  rejectStartup(new Error(`Built API exited before startup (code=${code}, signal=${signal}).\n${output}`))
})

let shutdownResult
try {
  const port = await portPromise
  const response = await fetch(`http://127.0.0.1:${port}/healthz`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'writer-agent-api' })
} finally {
  clearTimeout(startupTimeout)
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM')
    let shutdownTimer
    const forcedShutdown = new Promise((resolveShutdown) => {
      shutdownTimer = setTimeout(() => {
        child.kill('SIGKILL')
        resolveShutdown(null)
      }, 5_000)
    })
    shutdownResult = await Promise.race([exitPromise, forcedShutdown])
    clearTimeout(shutdownTimer)
  } else {
    shutdownResult = await exitPromise
  }
  await rm(fixtureRoot, { recursive: true, force: true })
}

assert.deepEqual(shutdownResult, { code: 0, signal: null }, `Built API did not shut down cleanly.\n${output}`)
process.stdout.write('Built API process started, returned /healthz, and shut down cleanly.\n')
