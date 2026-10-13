import type {
  ChallengeRequest,
  ChallengeResponse,
  ChatRequest,
  ChatResponse,
  Document,
  KnowledgeEntry,
  Chapter,
  RunReviewResponse,
  RunReviewRequest,
  SaveChapterRequest,
  SaveChapterResponse,
  WorkspaceSnapshot,
} from '@writer-agent/contracts'

export type WriterAgentSeed = {
  chapters: Chapter[]
  knowledge: KnowledgeEntry[]
  document: Document
}

export class ChapterRevisionConflictError extends Error {
  constructor(message = '章节已在其他位置更新。请保留当前编辑并重新加载最新版本后再保存。') {
    super(message)
    this.name = 'ChapterRevisionConflictError'
  }
}

/** Replace this adapter without changing the studio components. */
export interface WriterAgentAdapter {
  readonly mode: 'demo' | 'api'
  loadWorkspace(projectId: string): Promise<WorkspaceSnapshot>
  saveChapter(input: SaveChapterRequest): Promise<SaveChapterResponse>
  runReview(input: RunReviewRequest): Promise<RunReviewResponse>
  sendMessage(input: ChatRequest): Promise<ChatResponse>
  challenge(input: ChallengeRequest): Promise<ChallengeResponse>
}

export type { ChallengeRequest, ChatRequest, RunReviewRequest, SaveChapterRequest }
