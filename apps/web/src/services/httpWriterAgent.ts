import {
  challengeResponseSchema,
  chatResponseSchema,
  runReviewResponseSchema,
  saveChapterResponseSchema,
  type ChallengeRequest,
  type ChallengeResponse,
  type ChatRequest,
  type ChatResponse,
  type RunReviewRequest,
  type SaveChapterRequest,
  type SaveChapterResponse,
} from '@writer-agent/contracts'
import type { WriterAgentAdapter, WriterAgentSeed } from './writerAgent'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`)
  return response.json() as Promise<T>
}

/** HTTP adapter for the future backend. It has no LLM or Agent runtime of its own. */
export function createHttpWriterAgentAdapter(seed: WriterAgentSeed): WriterAgentAdapter {
  return {
    seed,
    async saveChapter(input: SaveChapterRequest) {
      const value = await postJson<unknown>('/api/chapters', input)
      return saveChapterResponseSchema.parse(value) as SaveChapterResponse
    },
    async runReview(input: RunReviewRequest) {
      return runReviewResponseSchema.parse(await postJson<unknown>('/api/agent/reviews', input))
    },
    async sendMessage(input: ChatRequest) {
      return chatResponseSchema.parse(await postJson<unknown>('/api/agent/chat', input)) as ChatResponse
    },
    async challenge(input: ChallengeRequest) {
      return challengeResponseSchema.parse(await postJson<unknown>('/api/agent/challenges', input)) as ChallengeResponse
    },
  }
}
