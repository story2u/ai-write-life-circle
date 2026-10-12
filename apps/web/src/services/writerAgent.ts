import type {
  ChallengeRequest,
  ChallengeResponse,
  ChatRequest,
  ChatResponse,
  Document,
  KnowledgeEntry,
  Chapter,
  Proposal,
  RunReviewRequest,
  SaveChapterRequest,
  SaveChapterResponse,
} from '@writer-agent/contracts'

export type WriterAgentSeed = {
  chapters: Chapter[]
  knowledge: KnowledgeEntry[]
  document: Document
}

/** Replace this adapter without changing the studio components. */
export interface WriterAgentAdapter {
  readonly seed: WriterAgentSeed
  saveChapter(input: SaveChapterRequest): Promise<SaveChapterResponse>
  runReview(input: RunReviewRequest): Promise<{ proposals: Proposal[]; demo: boolean }>
  sendMessage(input: ChatRequest): Promise<ChatResponse>
  challenge(input: ChallengeRequest): Promise<ChallengeResponse>
}

export type { ChallengeRequest, ChatRequest, RunReviewRequest, SaveChapterRequest }
