import type {
  ChallengeRequest,
  ChallengeResponse,
  ChatRequest,
  ChatResponse,
  RunReviewRequest,
  SaveChapterRequest,
  SaveChapterResponse,
} from '@writer-agent/contracts'
import { mockChallenge, mockChat, mockReview } from './demoData'
import type { WriterAgentAdapter, WriterAgentSeed } from '../services/writerAgent'

const STORAGE_KEY = 'writer-agent.v2'

/** Demo-only adapter. All Agent-like replies are deterministic templates and marked as demo. */
export function createDemoWriterAgentAdapter(seed: WriterAgentSeed): WriterAgentAdapter {
  return {
    seed,
    async saveChapter(input: SaveChapterRequest): Promise<SaveChapterResponse> {
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { doc?: Record<string, string[]> }
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, doc: { ...saved.doc, [input.chapterId]: input.paragraphs } }))
        } catch {
          // The workspace persistence effect will replace malformed demo storage on its next save.
        }
      }
      return { chapterId: input.chapterId, savedAt: Date.now() }
    },
    async runReview(input: RunReviewRequest) {
      const document = { [input.chapterId]: input.paragraphs }
      return { proposals: mockReview(input.chapterId, document, input.sequence), demo: true }
    },
    async sendMessage(input: ChatRequest): Promise<ChatResponse> {
      return { ...mockChat(input.text, input.quote), demo: true }
    },
    async challenge(input: ChallengeRequest): Promise<ChallengeResponse> {
      return { ...mockChallenge(input.intent, input.previousRounds), demo: true }
    },
  }
}
