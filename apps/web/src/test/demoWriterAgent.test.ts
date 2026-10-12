import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoWriterAgentAdapter } from '../mocks/demoWriterAgent'
import { chapters, initialDoc, knowledge } from '../mocks/demoData'

describe('demo adapter', () => {
  const adapter = createDemoWriterAgentAdapter({ chapters, knowledge, document: initialDoc })

  beforeEach(() => localStorage.clear())

  it('labels every generated response as demo data', async () => {
    const review = await adapter.runReview({ chapterId: 'c12', paragraphs: initialDoc.c12, sequence: 0 })
    const chat = await adapter.sendMessage({ chapterId: 'c12', text: '沈砚在想什么？' })
    const challenge = await adapter.challenge({ intent: '测试观点', previousRounds: [] })

    expect(review.demo).toBe(true)
    expect(chat.demo).toBe(true)
    expect(challenge.demo).toBe(true)
  })

  it('saves author-edited chapter paragraphs through the adapter seam', async () => {
    const paragraphs = ['作者明确保存的段落。']
    await adapter.saveChapter({ chapterId: 'c14', paragraphs })
    expect(JSON.parse(localStorage.getItem('writer-agent.v2') || '{}').doc.c14).toEqual(paragraphs)
  })
})
