import { chapterListV04Schema, chapterDetailV04Schema, type ChapterDetailV04, type ChapterListV04 } from '@writer-agent/contracts'
import { basename } from 'node:path'
import type { HarnessWorkspaceProjection } from '../harness/types.js'
import { FileChapterRevisionStore } from './revision-store.js'

export type ChapterSource = {
  chapterId: string
  title: string
  volumeId?: string
  meta?: string
  order?: number
  paragraphs: string[]
  sourceHash: string
  sourceRevisionId: string
}

function toChapterSources(projection: HarnessWorkspaceProjection): ChapterSource[] {
  return projection.chapterDocuments.flatMap((document) => {
    // Require the stable ID in the existing leading key-value metadata block;
    // a filename or template placeholder alone is not a formal chapter.
    if (document.idSource !== 'metadata' || !/^CH-\d{1,6}$/.test(document.stableId ?? '')) return []
    if (!basename(document.path).startsWith(`${document.stableId}.`) && !basename(document.path).startsWith(`${document.stableId}-`)) {
      throw new InvalidChapterSourceError(document.stableId!, 'filename must begin with the stable chapter ID')
    }
    const title = document.title ?? document.metadata.title
    if (!title?.trim()) throw new InvalidChapterSourceError(document.stableId!, 'a level-one Markdown title is required')
    const paragraphs = document.bodyMarkdown.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
    const rawOrder = document.metadata.order
    const order = rawOrder === undefined ? undefined : Number(rawOrder)
    if (rawOrder !== undefined && (!/^\d+$/.test(rawOrder) || !Number.isSafeInteger(order) || order === undefined || order < 1)) {
      throw new InvalidChapterSourceError(document.stableId!, 'order must be a positive integer')
    }
    return [{
      chapterId: document.stableId!,
      title: title.trim(),
      volumeId: document.metadata.volumeId || undefined,
      meta: document.metadata.meta || undefined,
      order,
      paragraphs,
      sourceHash: document.sha256,
      sourceRevisionId: `source:${document.gitBlobHash}`,
    }]
  })
}

export class ChapterNotFoundError extends Error {
  readonly code = 'NOT_FOUND'

  constructor(readonly chapterId: string) {
    super(`Chapter ${chapterId} was not found in the Harness.`)
    this.name = 'ChapterNotFoundError'
  }
}

export class DuplicateChapterIdError extends Error {
  readonly code = 'VALIDATION_FAILED'

  constructor(readonly chapterId: string, readonly paths: string[]) {
    super(`Chapter ID ${chapterId} is declared by more than one Harness file.`)
    this.name = 'DuplicateChapterIdError'
  }
}

export class InvalidChapterSourceError extends Error {
  readonly code = 'VALIDATION_FAILED'

  constructor(readonly chapterId: string, reason: string) {
    super(`Chapter source ${chapterId} is invalid: ${reason}.`)
    this.name = 'InvalidChapterSourceError'
  }
}

function compareChapterIds(left: string, right: string): number {
  const leftNumber = Number(left.slice('CH-'.length))
  const rightNumber = Number(right.slice('CH-'.length))
  return leftNumber - rightNumber || left.localeCompare(right)
}

export function listHarnessChapters(projection: HarnessWorkspaceProjection): ChapterListV04 {
  const chapterCollision = projection.idCollisions.find((collision) => /^CH-\d{1,6}$/.test(collision.id))
  if (chapterCollision) throw new DuplicateChapterIdError(chapterCollision.id, chapterCollision.paths)
  const chapters = toChapterSources(projection)
  const byId = new Map<string, ChapterSource[]>()
  for (const chapter of chapters) byId.set(chapter.chapterId, [...(byId.get(chapter.chapterId) ?? []), chapter])
  for (const [chapterId, matches] of byId) {
    if (matches.length > 1) throw new DuplicateChapterIdError(chapterId, projection.chapterDocuments.filter((document) => document.stableId === chapterId).map((document) => document.path))
  }

  const groups = new Map<string, { volumeId?: string; chapters: ChapterSource[] }>()
  for (const chapter of chapters) {
    const key = chapter.volumeId ?? '__no_volume_id__'
    const group = groups.get(key) ?? { volumeId: chapter.volumeId, chapters: [] }
    group.chapters.push(chapter)
    groups.set(key, group)
  }

  return chapterListV04Schema.parse({
    volumes: [...groups.values()].map((group) => ({
      ...(group.volumeId ? { volumeId: group.volumeId } : {}),
      chapters: group.chapters.sort((left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
        || compareChapterIds(left.chapterId, right.chapterId),
      ).map((chapter) => ({
        chapterId: chapter.chapterId,
        title: chapter.title,
        ...(chapter.meta ? { meta: chapter.meta } : {}),
        ...(chapter.order !== undefined ? { order: chapter.order } : {}),
        wordCount: countWords(chapter.paragraphs),
      })),
    })),
  })
}

export function getUniqueHarnessChapterSource(projection: HarnessWorkspaceProjection, chapterId: string): ChapterSource {
  const collision = projection.idCollisions.find((item) => item.id === chapterId)
  if (collision) throw new DuplicateChapterIdError(chapterId, collision.paths)
  const matches = toChapterSources(projection).filter((chapter) => chapter.chapterId === chapterId)
  if (matches.length === 0) throw new ChapterNotFoundError(chapterId)
  if (matches.length > 1) {
    throw new DuplicateChapterIdError(chapterId, projection.chapterDocuments.filter((document) => document.stableId === chapterId).map((document) => document.path))
  }
  return matches[0]
}

export async function getHarnessChapter(
  projection: HarnessWorkspaceProjection,
  chapterId: string,
  projectId: string,
  revisions: FileChapterRevisionStore,
): Promise<ChapterDetailV04> {
  const chapter = getUniqueHarnessChapterSource(projection, chapterId)
  const headRevision = await revisions.getHead(projectId, chapter)
  return chapterDetailV04Schema.parse({
    chapterId: chapter.chapterId,
    ...(chapter.volumeId ? { volumeId: chapter.volumeId } : {}),
    title: chapter.title,
    ...(chapter.meta ? { meta: chapter.meta } : {}),
    headRevision,
  })
}

export function countWords(paragraphs: string[]): number {
  return Array.from(paragraphs.join('').replace(/\s+/g, '')).length
}

export { toChapterSources }
