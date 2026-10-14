import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import YAML from 'yaml'
import { authorNoteSchema, noteCreateSchema, noteUpdateSchema } from '@writer-agent/contracts'
import { describe, expect, it } from 'vitest'
import { createApiHandler, type ApiActor } from '../src/http.js'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'writer-notes-'))
  const harness = join(root, 'harness'); const state = join(root, 'state')
  await mkdir(join(harness, 'manuscript'), { recursive: true })
  const source = '# Test\nID: CH-001\n\nFixture body.\n'
  await writeFile(join(harness, 'manuscript/CH-001.md'), source)
  let actor: ApiActor | null = { id: 'writer', role: 'author' }
  const make = () => createApiHandler({ harnessRoot: harness, projectId: 'test', stateDirectory: state, resolveActor: async () => actor })
  let handler = make()
  const request = (path = '', method = 'GET', body?: unknown, key = 'key') => handler(new Request(`http://localhost/v1/projects/test/notes${path}`, { method, headers: { 'content-type': 'application/json', 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
  return { root, harness, source, state, request, restart: () => { handler = make() }, role: (value: ApiActor | null) => { actor = value } }
}
const input = { content: '作者的测试笔记', chapterId: 'CH-001', purpose: 'note' as const }

describe('author notes application state', () => {
  it('persists creation, details, updates, archive and retry results across restarts without Harness mutations', async () => {
    const f = await fixture()
    const created = await f.request('', 'POST', input)
    expect(created.status).toBe(201)
    const note = authorNoteSchema.parse(await created.json())
    f.restart()
    expect(await (await f.request()).json()).toEqual({ items: [note] })
    expect(await (await f.request(`/${note.noteId}`)).json()).toEqual(note)
    expect(await (await f.request('', 'POST', input)).json()).toEqual(note)
    expect((await f.request('', 'POST', { ...input, content: '不同内容' })).status).toBe(422)
    const update = { ...input, content: '修订后的想法', baseVersion: 1, status: 'archived' }
    const saved = authorNoteSchema.parse(await (await f.request(`/${note.noteId}`, 'PATCH', update, 'update')).json())
    expect(saved.version).toBe(2)
    f.restart()
    expect(await (await f.request(`/${note.noteId}`, 'PATCH', update, 'update')).json()).toEqual(saved)
    expect((await f.request(`/${note.noteId}`, 'PATCH', update, 'stale')).status).toBe(409)
    expect(await readFile(join(f.harness, 'manuscript/CH-001.md'), 'utf8')).toBe(f.source)
    const state = JSON.parse(await readFile(join(f.state, 'notes', `${Buffer.from('test').toString('base64url')}.json`), 'utf8')) as { audit: unknown[] }
    expect(state.audit).toHaveLength(2)
  })
  it('allows one writer to win parallel optimistic edits and never silently replaces another next-writing plan', async () => {
    const f = await fixture()
    const note = authorNoteSchema.parse(await (await f.request('', 'POST', input)).json())
    const responses = await Promise.all(['a', 'b'].map((value) => f.request(`/${note.noteId}`, 'PATCH', { ...input, content: value, baseVersion: 1, status: 'active' }, value)))
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await f.request('', 'POST', { ...input, purpose: 'next_writing' }, 'plan')).status).toBe(201)
    expect((await f.request('', 'POST', { ...input, purpose: 'next_writing' }, 'other-plan')).status).toBe(409)
  })
  it('enforces authenticated author access, project scope and strict validation', async () => {
    const f = await fixture()
    for (const actor of [null, { id: 'bot', role: 'agent' as const }, { id: 'system', role: 'system' as const }]) {
      f.role(actor)
      for (const method of ['GET', 'POST', 'PATCH']) expect((await f.request(method === 'PATCH' ? '/unknown' : '', method, method === 'GET' ? undefined : input)).status).toBe(actor ? 403 : 401)
    }
    f.role({ id: 'writer', role: 'author' })
    for (const payload of [{ ...input, content: ' ' }, { ...input, chapterId: 'CH-404' }, { ...input, canon: true }, { ...input, content: 'x'.repeat(20001) }]) {
      expect([404, 422]).toContain((await f.request('', 'POST', payload, crypto.randomUUID())).status)
    }
    expect((await f.request('', 'POST', input, '')).status).toBe(422)
    expect((await f.request('/missing', 'PATCH', { ...input, baseVersion: 1, status: 'active' })).status).toBe(404)
    expect((await f.request('/%E0%A4%A')).status).toBe(400)
    const different = createApiHandler({ harnessRoot: f.harness, projectId: 'other', stateDirectory: f.state, resolveActor: async () => ({ id: 'writer', role: 'author' }) })
    expect((await different(new Request('http://localhost/v1/projects/test/notes'))).status).toBe(404)
  })
  it('reports storage failures and never creates a success response', async () => {
    const f = await fixture(); await writeFile(f.state, 'not a directory')
    const response = await f.request('', 'POST', input)
    expect(response.status).toBe(500)
  })
  it('matches runtime schemas to OpenAPI requests, responses and errors', async () => {
    const spec = YAML.parse(await readFile(fileURLToPath(new URL('../../../docs/contracts/api-spec-v0.4.0-proposed.yaml', import.meta.url)), 'utf8'))
    const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv); ajv.addSchema(spec, 'https://writer.test/notes')
    const valid = (schema: string, body: unknown) => { const check = ajv.compile({ $ref: `https://writer.test/notes#/components/schemas/${schema}` }); expect(check(body), JSON.stringify(check.errors)).toBe(true) }
    const f = await fixture(); valid('NoteCreate', noteCreateSchema.parse(input))
    const response = await f.request('', 'POST', input); const note = authorNoteSchema.parse(await response.json()); valid('AuthorNote', note)
    valid('NoteList', await (await f.request()).json())
    const update = noteUpdateSchema.parse({ ...input, baseVersion: 1, status: 'active' }); valid('NoteUpdate', update)
    valid('AuthorNote', await (await f.request(`/${note.noteId}`, 'PATCH', update, 'update')).json())
    valid('Problem', await (await f.request(`/${note.noteId}`, 'PATCH', update, 'stale')).json())
  })
})
