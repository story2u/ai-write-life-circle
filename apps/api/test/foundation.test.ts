import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appendAuditRecord } from '../src/audit/log.js'
import { assertExpectedRevision, RevisionConflictError } from '../src/concurrency/revision.js'
import { createApiHandler } from '../src/http.js'
import { FileIdAllocator, IdAllocationBlockedError } from '../src/ids/allocator.js'

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'writer-agent-state-'))
}

describe('ID allocation and audit foundation', () => {
  it('reserves unique IDs atomically without writing Harness files', async () => {
    const stateDirectory = await temporaryDirectory()
    const allocator = new FileIdAllocator(stateDirectory, async () => ({ ids: ['CHAR-003'], collisions: [] }))

    const ids = await Promise.all([allocator.reserve('CHAR'), allocator.reserve('CHAR')])
    expect(ids.sort()).toEqual(['CHAR-004', 'CHAR-005'])
    await expect(readFile(join(stateDirectory, 'id-reservations.json'), 'utf8')).resolves.toContain('"CHAR": 5')
  })

  it('blocks colliding and singleton ID prefixes while reserving chapter IDs', async () => {
    const stateDirectory = await temporaryDirectory()
    const allocator = new FileIdAllocator(stateDirectory, async () => ({ ids: ['WORLD-001'], collisions: ['WORLD-001'] }))

    await expect(allocator.reserve('WORLD')).rejects.toBeInstanceOf(IdAllocationBlockedError)
    await expect(allocator.reserve('CH')).resolves.toBe('CH-001')
    await expect(allocator.reserve('CH')).resolves.toBe('CH-002')
    await expect(allocator.reserve('INTENT')).rejects.toBeInstanceOf(IdAllocationBlockedError)
  })

  it('appends audit records without replacing prior entries', async () => {
    const stateDirectory = await temporaryDirectory()
    const base = {
      actor: { id: 'author-1', role: 'author' as const },
      action: 'workspace.read',
      objectRef: { type: 'project', id: 'project-1' },
      beforeHash: null,
      afterHash: null,
      requestId: 'request-1',
    }
    await appendAuditRecord(stateDirectory, base)
    await appendAuditRecord(stateDirectory, { ...base, requestId: 'request-2' })

    const lines = (await readFile(join(stateDirectory, 'audit.jsonl'), 'utf8')).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).requestId).toBe('request-1')
    expect(JSON.parse(lines[1]).requestId).toBe('request-2')
  })
})

describe('API shell and compare-and-swap guard', () => {
  it('returns health, protects the internal projection route, and scopes project access', async () => {
    const handler = createApiHandler({
      harnessRoot: '/unused',
      projectId: 'project-1',
      resolveActor: async () => null,
    })
    const health = await handler(new Request('http://localhost/healthz'))
    const denied = await handler(new Request('http://localhost/internal/projects/project-1/harness-projection'))
    const missing = await handler(new Request('http://localhost/internal/projects/other/harness-projection'))

    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({ status: 'ok' })
    expect(denied.status).toBe(401)
    expect(missing.status).toBe(404)
  })

  it('returns 409 instead of accepting a stale revision head', () => {
    expect(() => assertExpectedRevision('revision-2', 'revision-1')).toThrow(RevisionConflictError)
    expect(() => assertExpectedRevision('revision-2', 'revision-2')).not.toThrow()
  })
})
