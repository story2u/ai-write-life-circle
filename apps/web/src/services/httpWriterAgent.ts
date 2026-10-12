import {
  challengeResponseSchema,
  chatResponseSchema,
  runReviewResponseSchema,
  saveChapterResponseSchema,
  workspaceSnapshotSchema,
  type ChallengeRequest,
  type ChallengeResponse,
  type ChatRequest,
  type ChatResponse,
  type RunReviewRequest,
  type RunReviewResponse,
  type SaveChapterRequest,
  type SaveChapterResponse,
  type WorkspaceSnapshot,
} from '@writer-agent/contracts'
import { ChapterRevisionConflictError, type WriterAgentAdapter } from './writerAgent'

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown } catch { return null }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init)
  const value = await readJson(response)
  if (response.status === 409) {
    const message = typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string'
      ? value.message
      : undefined
    throw new ChapterRevisionConflictError(message)
  }
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`)
  return value
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** HTTP adapter. API mode loads the project snapshot from the server and never falls back to demo fixtures. */
export function createHttpWriterAgentAdapter(): WriterAgentAdapter {
  return {
    mode: 'api',
    async loadWorkspace(projectId: string): Promise<WorkspaceSnapshot> {
      const value = await requestJson(`/api/projects/${encodeURIComponent(projectId)}/workspace`)
      return workspaceSnapshotSchema.parse(value)
    },
    async saveChapter(input: SaveChapterRequest): Promise<SaveChapterResponse> {
      const value = await postJson('/api/chapters', input)
      return saveChapterResponseSchema.parse(value)
    },
    async runReview(input: RunReviewRequest): Promise<RunReviewResponse> {
      const value = await postJson('/api/agent/reviews', input)
      return runReviewResponseSchema.parse(value)
    },
    async sendMessage(input: ChatRequest): Promise<ChatResponse> {
      return chatResponseSchema.parse(await postJson('/api/agent/chat', input))
    },
    async challenge(input: ChallengeRequest): Promise<ChallengeResponse> {
      return challengeResponseSchema.parse(await postJson('/api/agent/challenges', input))
    },
  }
}
