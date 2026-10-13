import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises'
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
  const chapterPath = join(root, 'manuscript', 'chapter-one.md')
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
    const detail = await detailResponse.json() as { headRevision: { revisionId: string; paragraphs: string[] } }
    expect(detail.headRevision.paragraphs).toEqual(['First paragraph.', 'Second paragraph.'])

    const payload = {
      baseRevisionId: detail.headRevision.revisionId,
      paragraphs: ['Author draft paragraph.'],
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
      body: JSON.stringify({ ...payload, paragraphs: ['Different payload.'] }),
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
      body: JSON.stringify({ baseRevisionId: detail.headRevision.revisionId, paragraphs: ['Saved app draft.'] }),
    }))
    await writeFile(chapterPath, '# Chapter One\nID: CH-001\nvolumeId: VOL-01\norder: 1\nmeta: Opening\nupdated: 2026-10-14\n\nDifferent external edit.')

    const response = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('rejects duplicate chapter IDs instead of selecting one file for revision history', async () => {
    const { root } = await createChapterRepository()
    await writeFile(join(root, 'manuscript', 'chapter-two.md'), '# Chapter Two\nID: CH-001\nvolumeId: VOL-01\norder: 2\n\nA second source.')
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
