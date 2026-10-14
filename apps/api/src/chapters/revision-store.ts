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
  markdown: string
  idempotencyKey?: string
  requestHash: string
}

type ChapterDraftState = {
  sourceHash: string
  sourceRevision?: StoredDraftRevision
  /** The app draft whose exact content the author later committed to Harness. */
  adoptedDraftRevisionId?: string
  revisions: StoredDraftRevision[]
}

export type SavedDraftRevision = {
  revision: ChapterRevisionSummaryV04
  status: 200 | 201
  result: 'created' | 'idempotent_replay' | 'already_current'
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

function contentHash(markdown: string): string {
  return `sha256:${createHash('sha256').update(markdown, 'utf8').digest('hex')}`
}

function countWords(markdown: string): number {
  return Array.from(markdown.replace(/\s+/g, '')).length
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

  private sourceRevision(chapter: ChapterSource, parentRevisionId: string | null = null): StoredDraftRevision {
    return {
      revisionId: chapter.sourceRevisionId,
      parentRevisionId,
      contentHash: contentHash(chapter.markdown),
      wordCount: countWords(chapter.markdown),
      createdBy: { type: 'system', id: 'harness-reader', label: 'Harness 源文件' },
      commitRef: null,
      markdown: chapter.markdown,
      requestHash: '',
    }
  }

  private async loadState(projectId: string, chapterId: string): Promise<ChapterDraftState | null> {
    return readJsonFile<ChapterDraftState | null>(this.filePath(projectId, chapterId), null)
  }

  private async reconcileSourceVersion(projectId: string, chapter: ChapterSource, state: ChapterDraftState | null): Promise<ChapterDraftState | null> {
    if (!state) return null
    if (state.sourceHash === chapter.sourceHash) return state
    const latestDraft = state.revisions.at(-1)
    // An exact content match means the author committed the current app draft to
    // Harness. Persist the new source baseline and keep the prior draft in the
    // immutable history. Divergent edits remain a conflict.
    if (latestDraft?.contentHash === contentHash(chapter.markdown)) {
      const nextState: ChapterDraftState = {
        ...state,
        sourceHash: chapter.sourceHash,
        sourceRevision: this.sourceRevision(chapter, latestDraft.revisionId),
        adoptedDraftRevisionId: latestDraft.revisionId,
      }
      await writeJsonAtomically(this.filePath(projectId, chapter.chapterId), nextState)
      return nextState
    }
    const current = this.sourceRevision(chapter)
    throw new RevisionConflictError(state.revisions.at(-1)?.revisionId ?? null, current.revisionId)
  }

  private async withCoordinatedState<T>(projectId: string, chapter: ChapterSource, callback: (state: ChapterDraftState | null) => Promise<T>): Promise<T> {
    const path = this.filePath(projectId, chapter.chapterId)
    return withFileLock(`${path}.lock`, async () => {
      const loaded = await this.loadState(projectId, chapter.chapterId)
      const state = await this.reconcileSourceVersion(projectId, chapter, loaded)
      return callback(state)
    })
  }

  private headRevision(chapter: ChapterSource, state: ChapterDraftState | null): StoredDraftRevision {
    const latestDraft = state?.revisions.at(-1)
    if (latestDraft && state?.adoptedDraftRevisionId === latestDraft.revisionId && state.sourceRevision) return state.sourceRevision
    return latestDraft ?? state?.sourceRevision ?? this.sourceRevision(chapter)
  }

  async getHead(projectId: string, chapter: ChapterSource): Promise<ChapterRevisionSummaryV04 & { markdown: string }> {
    return this.withCoordinatedState(projectId, chapter, async (state) => {
      const revision = this.headRevision(chapter, state)
      return { ...publicSummary(revision), markdown: revision.markdown }
    })
  }

  async list(projectId: string, chapter: ChapterSource): Promise<ChapterRevisionSummaryV04[]> {
    return this.withCoordinatedState(projectId, chapter, async (state) => {
      const source = state?.sourceRevision ?? this.sourceRevision(chapter)
      const revisions = [source, ...(state?.revisions ?? [])]
      return revisions.slice().reverse().map(publicSummary)
    })
  }

  async save(
    projectId: string,
    chapter: ChapterSource,
    actor: ActorV04,
    request: ChapterRevisionCreateV04,
    idempotencyKey?: string,
  ): Promise<SavedDraftRevision> {
    const path = this.filePath(projectId, chapter.chapterId)
    const requestHash = contentHash(request.markdown)
    return withFileLock(`${path}.lock`, async () => {
      const loaded = await this.loadState(projectId, chapter.chapterId)
      const state = await this.reconcileSourceVersion(projectId, chapter, loaded)

      const priorByKey = idempotencyKey ? state?.revisions.find((revision) => revision.idempotencyKey === idempotencyKey) : undefined
      if (priorByKey) {
        if (priorByKey.requestHash !== requestHash || priorByKey.parentRevisionId !== request.baseRevisionId) throw new IdempotencyKeyReuseError()
        return { revision: publicSummary(priorByKey), status: 200, result: 'idempotent_replay' }
      }

      const head = this.headRevision(chapter, state)
      assertExpectedRevision(head.revisionId, request.baseRevisionId)
      if (head.contentHash === requestHash) return { revision: publicSummary(head), status: 200, result: 'already_current' }

      const revision: StoredDraftRevision = {
        revisionId: `draft:${randomUUID()}`,
        parentRevisionId: head.revisionId,
        contentHash: requestHash,
        wordCount: countWords(request.markdown),
        createdAt: this.now().toISOString(),
        createdBy: actor,
        commitRef: null,
        markdown: request.markdown,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        requestHash,
      }
      const nextState: ChapterDraftState = {
        sourceHash: chapter.sourceHash,
        sourceRevision: state?.sourceRevision ?? this.sourceRevision(chapter),
        ...(state?.adoptedDraftRevisionId ? { adoptedDraftRevisionId: state.adoptedDraftRevisionId } : {}),
        revisions: [...(state?.revisions ?? []), revision],
      }
      await writeJsonAtomically(path, nextState)
      return { revision: publicSummary(revision), status: 201, result: 'created' }
    })
  }
}
