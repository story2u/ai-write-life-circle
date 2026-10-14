import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './http.js'

const sourceDirectory = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = resolve(process.env.WRITER_AGENT_HARNESS_ROOT ?? resolve(sourceDirectory, '../../..'))
const projectId = process.env.WRITER_AGENT_PROJECT_ID ?? 'local'
const port = Number(process.env.WRITER_AGENT_API_PORT ?? 8787)
const stateDirectory = process.env.WRITER_AGENT_STATE_DIR ?? join(homedir(), '.local/share/ai-write-life-circle')

const handler = createApiHandler({
  harnessRoot: repositoryRoot,
  projectId,
  stateDirectory,
  environment: 'development',
  // The dev server binds to loopback and derives this local-only identity itself.
  // Replace it with the selected authentication adapter before any shared deployment.
  resolveActor: async () => ({ id: 'local-author', role: 'author' }),
})

const server = createServer(async (incoming, outgoing) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) for (const part of value) headers.append(name, part)
    else if (value !== undefined) headers.set(name, value)
  }
  const host = headers.get('host') ?? `127.0.0.1:${port}`
  const bodyChunks: Buffer[] = []
  if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
    for await (const chunk of incoming) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const request = new Request(`http://${host}${incoming.url ?? '/'}`, {
    method: incoming.method ?? 'GET',
    headers,
    ...((incoming.method !== 'GET' && incoming.method !== 'HEAD') ? { body: Buffer.concat(bodyChunks) } : {}),
  })

  try {
    const response = await handler(request)
    outgoing.writeHead(response.status, Object.fromEntries(response.headers))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    outgoing.writeHead(500, { 'content-type': 'application/problem+json' })
    outgoing.end(JSON.stringify({ type: 'about:blank', title: 'INTERNAL_ERROR', status: 500 }))
  }
})

server.listen(port, '127.0.0.1', () => {
  const address = server.address()
  const listeningPort = address && typeof address === 'object' ? address.port : port
  process.stdout.write(`Writer Agent API listening on http://127.0.0.1:${listeningPort}\n`)
  process.stdout.write(`Harness root: ${repositoryRoot}\n`)
})

const shutdown = () => server.close(() => { process.exitCode = 0 })
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
