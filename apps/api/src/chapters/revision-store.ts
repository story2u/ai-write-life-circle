import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { ActorV04, ChapterRevisionCreateV04, ChapterRevisionSummaryV04 } from '@writer-agent/contracts'
import { assertExpectedRevision, RevisionConflictError } from '../concurrency/revision.js'
import { readJsonFile, withFileLock, writeJsonAtomically } from '../storage/atomic-json.js'
import type { ChapterSource } from './repository.js'

type StoredDraftRevision = ChapterRevisionSummaryV04 & {
  revisionId: string
  parentRevisionId: string | null
  contentHash: string
  wordCount: number
  createdAt?: string
  createdBy: ActorV04
  commitRef: null
  paragraphs: string[]
  idempotencyKey?: string
  requestHash: string
}

type ChapterDraftState = {
  sourceHash: string
  revisions: StoredDraftRevision[]
}

export type SavedDraftRevision = {
  revision: ChapterRevisionSummaryV04
  status: 200 | 201
}

export class IdempotencyKeyReuseError extends Error {
  readonly code = 'VALIDATION_FAILED'

  constructor() {
    super('The Idempotency-Key was already used with a different chapter revision request.')
    this.name = 'IdempotencyKeyReuseError'
  }
}

function safeKey(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function contentHash(paragraphs: string[]): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(paragraphs)).digest('hex')}`
}

function countWords(paragraphs: string[]): number {
  return Array.from(paragraphs.join('').replace(/\s+/g, '')).length
}

function publicSummary(revision: StoredDraftRevision): ChapterRevisionSummaryV04 {
  return {
    revisionId: revision.revisionId,
    parentRevisionId: revision.parentRevisionId,
    contentHash: revision.contentHash,
    wordCount: revision.wordCount,
    ...(revision.createdAt ? { createdAt: revision.createdAt } : {}),
    createdBy: revision.createdBy,
    commitRef: revision.commitRef,
  }
}

export class FileChapterRevisionStore {
  constructor(private readonly stateDirectory: string, private readonly now = () => new Date()) {}

  private filePath(projectId: string, chapterId: string): string {
    return join(this.stateDirectory, 'chapter-drafts', safeKey(projectId), `${safeKey(chapterId)}.json`)
  }

  private sourceRevision(chapter: ChapterSource): StoredDraftRevision {
    const paragraphs = chapter.paragraphs
    return {
      revisionId: chapter.sourceRevisionId,
      parentRevisionId: null,
      contentHash: contentHash(paragraphs),
      wordCount: countWords(paragraphs),
      createdBy: { type: 'system', id: 'harness-reader', label: 'Harness 源文件' },
      commitRef: null,
      paragraphs,
      requestHash: '',
    }
  }

  private async loadState(projectId: string, chapterId: string): Promise<ChapterDraftState | null> {
    return readJsonFile<ChapterDraftState | null>(this.filePath(projectId, chapterId), null)
  }

  private async assertSourceVersion(chapter: ChapterSource, state: ChapterDraftState | null): Promise<void> {
    if (!state || state.sourceHash === chapter.sourceHash) return
    const latestDraft = state.revisions.at(-1)
    // The author may have committed the latest app draft to the Harness. Exact
    // content equality is enough to rebase the app state; a divergent edit is
    // returned as a conflict and never overwritten.
    if (latestDraft?.contentHash === contentHash(chapter.paragraphs)) return
    const current = this.sourceRevision(chapter)
    throw new RevisionConflictError(state.revisions.at(-1)?.revisionId ?? null, current.revisionId)
  }

  async getHead(projectId: string, chapter: ChapterSource): Promise<ChapterRevisionSummaryV04 & { paragraphs: string[] }> {
    const state = await this.loadState(projectId, chapter.chapterId)
    await this.assertSourceVersion(chapter, state)
    const revision = state?.revisions.at(-1) ?? this.sourceRevision(chapter)
    return { ...publicSummary(revision), paragraphs: [...revision.paragraphs] }
  }

  async list(projectId: string, chapter: ChapterSource): Promise<ChapterRevisionSummaryV04[]> {
    const state = await this.loadState(projectId, chapter.chapterId)
    await this.assertSourceVersion(chapter, state)
    const revisions = [this.sourceRevision(chapter), ...(state?.revisions ?? [])]
    return revisions.slice().reverse().map(publicSummary)
  }

  async save(
    projectId: string,
    chapter: ChapterSource,
    actor: ActorV04,
    request: ChapterRevisionCreateV04,
    idempotencyKey?: string,
  ): Promise<SavedDraftRevision> {
    const path = this.filePath(projectId, chapter.chapterId)
    const requestHash = contentHash(request.paragraphs)
    return withFileLock(`${path}.lock`, async () => {
      const state = await this.loadState(projectId, chapter.chapterId)
      await this.assertSourceVersion(chapter, state)

      const priorByKey = idempotencyKey ? state?.revisions.find((revision) => revision.idempotencyKey === idempotencyKey) : undefined
      if (priorByKey) {
        if (priorByKey.requestHash !== requestHash || priorByKey.parentRevisionId !== request.baseRevisionId) throw new IdempotencyKeyReuseError()
        return { revision: publicSummary(priorByKey), status: 200 }
      }

      const head = state?.revisions.at(-1) ?? this.sourceRevision(chapter)
      assertExpectedRevision(head.revisionId, request.baseRevisionId)
      if (head.contentHash === requestHash) return { revision: publicSummary(head), status: 200 }

      const revision: StoredDraftRevision = {
        revisionId: `draft:${randomUUID()}`,
        parentRevisionId: head.revisionId,
        contentHash: requestHash,
        wordCount: countWords(request.paragraphs),
        createdAt: this.now().toISOString(),
        createdBy: actor,
        commitRef: null,
        paragraphs: [...request.paragraphs],
        ...(idempotencyKey ? { idempotencyKey } : {}),
        requestHash,
      }
      const nextState: ChapterDraftState = {
        sourceHash: chapter.sourceHash,
        revisions: [...(state?.revisions ?? []), revision],
      }
      await writeJsonAtomically(path, nextState)
      return { revision: publicSummary(revision), status: 201 }
    })
  }
}
