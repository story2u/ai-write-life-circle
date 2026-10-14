import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpWriterAgentAdapter } from '../services/httpWriterAgent'
import { ChapterRevisionConflictError } from '../services/writerAgent'

const sourceHash = `sha256:${'a'.repeat(64)}`
const workspace = {
  projectId: 'novel-123',
  chapters: [{ id: 'chapter-1', volume: '卷一', title: '第一章', meta: '秋 · 江宁' }],
  knowledge: [],
  document: { 'chapter-1': ['来自服务端的正文。'] },
  chapterVersions: { 'chapter-1': { revision: 7, sourceHash } },
  proposals: [], decisions: [], chat: [], challenge: [], sequence: 0, currentChapterId: 'chapter-1',
}

describe('HTTP workspace adapter', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('loads the selected project from the API without reading the demo workspace cache', async () => {
    localStorage.setItem('writer-agent.v2', JSON.stringify({ doc: { 'chapter-1': ['演示正文'] } }))
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(workspace), { status: 200 }))

    const adapter = createHttpWriterAgentAdapter()
    const loaded = await adapter.loadWorkspace('novel-123')

    expect(adapter.mode).toBe('api')
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/novel-123/workspace', undefined)
    expect(storageRead).not.toHaveBeenCalled()
    expect(loaded.document['chapter-1']).toEqual(['来自服务端的正文。'])
  })

  it('surfaces a server revision conflict and preserves the typed conflict error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'server revision is newer' }), { status: 409 }))
    const adapter = createHttpWriterAgentAdapter()

    await expect(adapter.saveChapter({
      projectId: 'novel-123', chapterId: 'chapter-1', paragraphs: ['本地草稿'], markdown: '本地草稿', revision: 7, sourceHash,
    })).rejects.toBeInstanceOf(ChapterRevisionConflictError)
  })
})
