import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = await mkdtemp(join(tmpdir(), 'writer-production-smoke-'))
const tokenFile = join(root, 'token')
const state = join(root, 'state')
const binary = resolve('apps/api-go/dist/writer-agent-api')
const project = 'production-smoke'
let token = randomBytes(32).toString('hex')
let running

async function start() {
  const child = spawn(binary, [], { env: {
    ...process.env, NODE_ENV: 'production', WRITER_AGENT_ENV: 'production',
    WRITER_AGENT_AUTH_MODE: 'bearer', WRITER_AGENT_AUTH_TOKEN_FILE: tokenFile,
    WRITER_AGENT_AUTHOR_ID: 'bruce', WRITER_AGENT_API_HOST: '127.0.0.1', WRITER_AGENT_API_PORT: '0',
    WRITER_AGENT_HARNESS_ROOT: root, WRITER_AGENT_STATE_DIR: state, WRITER_AGENT_PROJECT_ID: project,
  }, stdio: ['ignore', 'pipe', 'pipe'] })
  const exited = once(child, 'exit')
  let output = ''
  try {
    const port = await new Promise((resolvePort, reject) => {
      const timer = setTimeout(() => reject(new Error(`Production startup timed out: ${output}`)), 10_000)
      child.once('error', (error) => { clearTimeout(timer); reject(error) })
      child.once('exit', () => { clearTimeout(timer); reject(new Error(`Startup failed: ${output}`)) })
      child.stdout.on('data', (chunk) => {
        output += chunk
        const match = output.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/)
        if (match) { clearTimeout(timer); resolvePort(match[1]) }
      })
      child.stderr.on('data', (chunk) => { output += chunk })
    })
    return { url: `http://127.0.0.1:${port}`, async stop() {
      child.kill('SIGTERM')
      const timeout = setTimeout(() => child.kill('SIGKILL'), 5000)
      try { assert.deepEqual(await exited, [0, null]) } finally { clearTimeout(timeout) }
    } }
  } catch (error) { child.kill('SIGKILL'); await exited; throw error }
}

async function request(path, credential, init = {}) {
  return fetch(`${running.url}${path}`, { ...init, headers: {
    ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...init.headers,
  } })
}

try {
  await writeFile(tokenFile, `${token}\n`, { mode: 0o600 })
  running = await start()
  assert.equal((await request('/healthz')).status, 200)
  const notes = `/v1/projects/${project}/notes`
  for (const credential of [undefined, randomBytes(32).toString('hex')]) {
    const rejected = await request(notes, credential, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Actor-ID': 'attacker' }, body: '{"content":"must not persist"}' })
    assert.equal(rejected.status, 401)
    assert.match(rejected.headers.get('www-authenticate'), /^Bearer/)
  }
  assert.deepEqual(await (await request(notes, token)).json(), { items: [] })
  assert.equal((await request(`/internal/projects/${project}/harness-projection`, token)).status, 404)
  const key = randomUUID()
  const mutation = { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': key, 'X-Actor-ID': 'attacker', 'X-Actor-Role': 'agent' }, body: '{"content":"deployment authentication check"}' }
  const created = await request(notes, token, mutation)
  assert.equal(created.status, 201)
  const note = await created.json()
  assert.equal(note.createdBy, 'bruce')
  await running.stop(); running = undefined
  running = await start()
  assert.deepEqual(await (await request(notes, token, mutation)).json(), note)
  const items = (await (await request(notes, token)).json()).items
  assert.equal(items.length, 1)
  const stored = JSON.parse(await readFile(join(state, 'notes', `${Buffer.from(project).toString('base64url')}.json`), 'utf8'))
  assert.ok(stored.audit.every((entry) => entry.actorId === 'bruce'))
  await running.stop(); running = undefined
  const oldToken = token
  token = randomBytes(32).toString('hex')
  await writeFile(tokenFile, `${token}\n`, { mode: 0o600 })
  running = await start()
  assert.equal((await request(notes, oldToken)).status, 401)
  assert.equal((await request(notes, token)).status, 200)
  process.stdout.write('Production bearer authentication, actor isolation, persistence, replay and token rotation passed.\n')
} finally {
  if (running) await running.stop()
  await rm(root, { recursive: true, force: true })
}
