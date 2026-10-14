import { mkdtemp, readFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApiHandler } from '../src/http.js'

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'writer-agent-v04-'))
}

async function createChapterRepository(): Promise<{ root: string; chapterPath: string; source: string }> {
  const root = await temporaryDirectory()
  await mkdir(join(root, 'manuscript'), { recursive: true })
  const chapterPath = join(root, 'manuscript', 'CH-001.md')
  const source = '# Chapter One\nID: CH-001\nvolumeId: VOL-01\norder: 1\nmeta: Opening\nupdated: 2026-10-14\n\nFirst paragraph.\n\nSecond paragraph.'
  await writeFile(chapterPath, source)
  return { root, chapterPath, source }
}

describe('V0.4 workspace and chapter APIs', () => {
  it('restores author workspace state from app storage', async () => {
    const root = await temporaryDirectory()
    const stateDirectory = join(root, 'app-state')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory,
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const first = await handler(new Request('http://localhost/v1/projects/project-1/workspace'))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({
      project: { projectId: 'project-1' },
      userState: { lastView: 'write', theme: 'light' },
      counts: {},
    })

    const saved = await handler(new Request('http://localhost/v1/projects/project-1/workspace', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lastView: 'kb', theme: 'dark', layout: { focus: true } }),
    }))
    expect(saved.status).toBe(200)

    const restored = await handler(new Request('http://localhost/v1/projects/project-1/workspace'))
    expect(await restored.json()).toMatchObject({
      userState: { lastView: 'kb', theme: 'dark', layout: { focus: true, leftW: 280 } },
    })
  })

  it('saves immutable chapter drafts outside Harness, enforces author access and detects stale revisions', async () => {
    const { root, chapterPath, source } = await createChapterRepository()
    const stateDirectory = join(root, 'separate-app-state')
    let actorRole: 'author' | 'agent' = 'author'
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory,
      resolveActor: async () => ({ id: 'actor-1', role: actorRole }),
    })

    const list = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({ volumes: [{ volumeId: 'VOL-01', chapters: [{ chapterId: 'CH-001', title: 'Chapter One' }] }] })

    const detailResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))
    expect(detailResponse.status).toBe(200)
    expect(detailResponse.headers.get('etag')).toBeTruthy()
    const detail = await detailResponse.json() as { headRevision: { revisionId: string; markdown: string } }
    expect(detail.headRevision.markdown).toBe('First paragraph.\n\nSecond paragraph.')

    const payload = {
      baseRevisionId: detail.headRevision.revisionId,
      markdown: 'Author draft paragraph.',
      trigger: 'manual',
    }
    actorRole = 'agent'
    const denied = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'agent-save' },
      body: JSON.stringify(payload),
    }))
    expect(denied.status).toBe(403)

    actorRole = 'author'
    const saved = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'save-1' },
      body: JSON.stringify(payload),
    }))
    expect(saved.status).toBe(201)
    const revision = await saved.json() as { revisionId: string; parentRevisionId: string; commitRef: null }
    expect(revision).toMatchObject({ parentRevisionId: detail.headRevision.revisionId, commitRef: null })

    const replay = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'save-1' },
      body: JSON.stringify(payload),
    }))
    expect(replay.status).toBe(200)
    expect((await replay.json()).revisionId).toBe(revision.revisionId)

    const tooLongKey = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'k'.repeat(129) },
      body: JSON.stringify(payload),
    }))
    expect(tooLongKey.status).toBe(422)

    const reusedKey = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'save-1' },
      body: JSON.stringify({ ...payload, markdown: 'Different payload.' }),
    }))
    expect(reusedKey.status).toBe(422)

    const conflicting = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'save-stale' },
      body: JSON.stringify(payload),
    }))
    expect(conflicting.status).toBe(409)
    expect(await conflicting.json()).toMatchObject({ code: 'REVISION_CONFLICT' })

    const after = await readFile(chapterPath, 'utf8')
    expect(after).toBe(source)
    expect(await readFile(join(stateDirectory, 'chapter-drafts', 'cHJvamVjdC0x', 'Q0gtMDAx.json'), 'utf8')).toContain('Author draft paragraph.')

    const events = (await readFile(join(stateDirectory, 'audit.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { action: string; requestId: string; correlationId: string; result?: string; failureType?: string })
    expect(events.map((event) => event.action)).toEqual([
      'chapter.revision.save_requested', 'chapter.revision.save_failed',
      'chapter.revision.save_requested', 'chapter.revision.saved',
      'chapter.revision.save_requested', 'chapter.revision.saved',
      'chapter.revision.save_requested', 'chapter.revision.save_failed',
      'chapter.revision.save_requested', 'chapter.revision.save_failed',
      'chapter.revision.save_requested', 'chapter.revision.conflict',
    ])
    expect(events.every((event) => event.requestId === event.correlationId)).toBe(true)
    expect(events[3]).toMatchObject({ result: 'created' })
    expect(events[5]).toMatchObject({ result: 'idempotent_replay' })
    expect(events[1]).toMatchObject({ failureType: 'permission' })
    expect(events.at(-1)).toMatchObject({ failureType: 'conflict' })
  })

  it('persists no-op idempotency keys across API reinitialization and rejects reuse with different content', async () => {
    const { root, chapterPath, source } = await createChapterRepository()
    const stateDirectory = join(root, 'state')
    const createHandler = () => createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory,
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })
    let handler = createHandler()
    const detail = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))).json() as {
      headRevision: { revisionId: string }
    }
    const save = (markdown: string) => handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'no-op-key' },
      body: JSON.stringify({ baseRevisionId: detail.headRevision.revisionId, markdown }),
    }))

    const unchanged = await save('First paragraph.\n\nSecond paragraph.')
    expect(unchanged.status).toBe(200)
    expect((await unchanged.json()).revisionId).toBe(detail.headRevision.revisionId)

    // Simulate a service restart: the new handler must reload the persisted key.
    handler = createHandler()
    const replay = await save('First paragraph.\n\nSecond paragraph.')
    expect(replay.status).toBe(200)
    expect((await replay.json()).revisionId).toBe(detail.headRevision.revisionId)

    const changedReuse = await save('Different content must not reuse the key.')
    expect(changedReuse.status).toBe(422)
    expect(await changedReuse.json()).toMatchObject({ code: 'VALIDATION_FAILED' })

    const stored = JSON.parse(await readFile(join(stateDirectory, 'chapter-drafts', 'cHJvamVjdC0x', 'Q0gtMDAx.json'), 'utf8')) as {
      revisions: Array<{ revisionId: string }>
      noOpIdempotencyRecords: Array<{ idempotencyKey: string; requestHash: string; baseRevisionId: string; revision: { revisionId: string } }>
    }
    expect(stored.revisions).toEqual([])
    expect(stored.noOpIdempotencyRecords).toMatchObject([{
      idempotencyKey: 'no-op-key',
      baseRevisionId: detail.headRevision.revisionId,
      revision: { revisionId: detail.headRevision.revisionId },
    }])
    expect(await readFile(chapterPath, 'utf8')).toBe(source)
    const events = (await readFile(join(stateDirectory, 'audit.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { action: string; result?: string })
    expect(events.map((event) => event.action)).toEqual([
      'chapter.revision.save_requested', 'chapter.revision.saved',
      'chapter.revision.save_requested', 'chapter.revision.saved',
      'chapter.revision.save_requested', 'chapter.revision.save_failed',
    ])
    expect(events[1]).toMatchObject({ result: 'already_current' })
    expect(events[3]).toMatchObject({ result: 'idempotent_replay' })
  })

  it('returns a conflict instead of masking an external source edit after a draft', async () => {
    const { root, chapterPath } = await createChapterRepository()
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'state'),
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })
    const detail = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))).json() as { headRevision: { revisionId: string } }
    await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevisionId: detail.headRevision.revisionId, markdown: 'Saved app draft.' }),
    }))
    await writeFile(chapterPath, '# Chapter One\nID: CH-001\nvolumeId: VOL-01\norder: 1\nmeta: Opening\nupdated: 2026-10-14\n\nDifferent external edit.')

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('records a correlated storage failure without claiming the draft was saved', async () => {
    const { root } = await createChapterRepository()
    const stateDirectory = join(root, 'state')
    await mkdir(stateDirectory, { recursive: true })
    // Make revision storage unwritable while leaving the audit directory writable.
    await writeFile(join(stateDirectory, 'chapter-drafts'), 'not a directory')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory,
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'storage-test-1' },
      body: JSON.stringify({ baseRevisionId: 'source:unused', markdown: 'Unsaved draft.' }),
    }))
    expect(response.status).toBe(500)
    expect(response.headers.get('x-request-id')).toBe('storage-test-1')
    expect(await response.json()).toMatchObject({ code: 'HARNESS_WRITE_FAILED', requestId: 'storage-test-1' })

    const events = (await readFile(join(stateDirectory, 'audit.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { action: string; requestId: string; correlationId: string; result?: string; failureType?: string })
    expect(events.map((event) => event.action)).toEqual(['chapter.revision.save_requested', 'chapter.revision.save_failed'])
    expect(events[1]).toMatchObject({ requestId: 'storage-test-1', correlationId: 'storage-test-1', result: 'storage_failed', failureType: 'storage' })
    expect(events.some((event) => event.action === 'chapter.revision.saved')).toBe(false)
  })

  it('rebases an exact app draft committed to Harness, then saves later drafts without losing revision history', async () => {
    const { root, chapterPath } = await createChapterRepository()
    const stateDirectory = join(root, 'state')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory,
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })
    const initial = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))).json() as { headRevision: { revisionId: string } }
    const save = async (baseRevisionId: string, markdown: string, key: string) => handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ baseRevisionId, markdown }),
    }))

    const savedB = await save(initial.headRevision.revisionId, 'Draft B\n\n> 引用段落。\n', 'draft-b')
    expect(savedB.status).toBe(201)
    const revisionB = await savedB.json() as { revisionId: string }

    // Simulate the author's separate Git commit of the already-saved draft B.
    await writeFile(chapterPath, '# Chapter One\nID: CH-001\nvolumeId: VOL-01\norder: 1\nmeta: Opening\nupdated: 2026-10-14\n\nDraft B\n\n> 引用段落。\n')
    const committed = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))).json() as { headRevision: { revisionId: string; markdown: string } }
    expect(committed.headRevision.revisionId).toMatch(/^source:/)
    expect(committed.headRevision.markdown).toBe('Draft B\n\n> 引用段落。\n')

    const savedC = await save(committed.headRevision.revisionId, 'Draft C\n\n- 列表项。', 'draft-c')
    expect(savedC.status).toBe(201)
    const revisionC = await savedC.json() as { revisionId: string; parentRevisionId: string }
    expect(revisionC.parentRevisionId).toBe(committed.headRevision.revisionId)

    const savedD = await save(revisionC.revisionId, 'Draft D with **format**.', 'draft-d')
    expect(savedD.status).toBe(201)
    const revisionD = await savedD.json() as { revisionId: string; parentRevisionId: string }
    expect(revisionD.parentRevisionId).toBe(revisionC.revisionId)

    const final = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))).json() as { headRevision: { revisionId: string; markdown: string } }
    expect(final.headRevision).toMatchObject({ revisionId: revisionD.revisionId, markdown: 'Draft D with **format**.' })
    const history = await (await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions'))).json() as { items: Array<{ revisionId: string; parentRevisionId: string | null }> }
    expect(history.items.map((item) => item.revisionId)).toEqual([
      revisionD.revisionId,
      revisionC.revisionId,
      committed.headRevision.revisionId,
      revisionB.revisionId,
      initial.headRevision.revisionId,
    ])
    expect(history.items.map((item) => item.parentRevisionId)).toEqual([
      revisionC.revisionId,
      committed.headRevision.revisionId,
      revisionB.revisionId,
      initial.headRevision.revisionId,
      null,
    ])
    const state = JSON.parse(await readFile(join(stateDirectory, 'chapter-drafts', 'cHJvamVjdC0x', 'Q0gtMDAx.json'), 'utf8')) as {
      sourceHash: string
      sourceRevisionHistory: Array<{ revisionId: string }>
      revisions: Array<{ revisionId: string }>
    }
    const committedSourceHash = `sha256:${createHash('sha256').update(await readFile(chapterPath)).digest('hex')}`
    expect(state.sourceHash).toBe(committedSourceHash)
    expect(state.sourceRevisionHistory.map((revision) => revision.revisionId)).toEqual([initial.headRevision.revisionId])
    expect(state.revisions.map((revision) => revision.revisionId)).toEqual([revisionB.revisionId, revisionC.revisionId, revisionD.revisionId])
  })

  it('orders chapters by Harness metadata and rejects invalid order values', async () => {
    const { root, chapterPath, source } = await createChapterRepository()
    await writeFile(chapterPath, source.replace('order: 1', 'order: 2'))
    await writeFile(join(root, 'manuscript', 'CH-002.md'), '# Chapter Two\nID: CH-002\nvolumeId: VOL-01\norder: 1\n\nAnother author chapter.')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'state'),
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const list = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    expect(await list.json()).toMatchObject({
      volumes: [{ chapters: [{ chapterId: 'CH-002', order: 1 }, { chapterId: 'CH-001', order: 2 }] }],
    })

    await writeFile(chapterPath, source.replace('order: 1', 'order: 0'))
    const invalid = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toMatchObject({ code: 'VALIDATION_FAILED', current: { chapterId: 'CH-001' } })
  })

  it('rejects chapter filenames that do not start with the metadata ID', async () => {
    const { root, chapterPath } = await createChapterRepository()
    await rename(chapterPath, join(root, 'manuscript', 'chapter-one.md'))
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'state'),
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', current: { chapterId: 'CH-001' } })
  })

  it('requires a level-one title for a formal chapter source', async () => {
    const { root, chapterPath } = await createChapterRepository()
    await writeFile(chapterPath, 'ID: CH-001\nvolumeId: VOL-01\norder: 1\n\nChapter body.')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'state'),
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', current: { chapterId: 'CH-001' } })
  })

  it('rejects duplicate chapter IDs instead of selecting one file for revision history', async () => {
    const { root } = await createChapterRepository()
    await writeFile(join(root, 'manuscript', 'CH-001-copy.md'), '# Chapter Two\nID: CH-001\nvolumeId: VOL-01\norder: 2\n\nA second source.')
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'state'),
      resolveActor: async () => ({ id: 'author-1', role: 'author' }),
    })

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', current: { chapterId: 'CH-001' } })
  })
})
