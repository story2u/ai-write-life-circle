import {
  chapterRevisionCreateV04Schema,
  userWorkspaceStateV04Schema,
  workspaceV04Schema,
} from '@writer-agent/contracts'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { rebuildHarnessProjection } from './harness/projection.js'
import type { HarnessWorkspaceProjection } from './harness/types.js'
import { ChapterNotFoundError, DuplicateChapterIdError, InvalidChapterSourceError, getHarnessChapter, getUniqueHarnessChapterSource, listHarnessChapters } from './chapters/repository.js'
import { FileChapterRevisionStore, IdempotencyKeyReuseError } from './chapters/revision-store.js'
import { RevisionConflictError } from './concurrency/revision.js'
import { appendAuditRecord } from './audit/log.js'
import { FileWorkspaceStateStore } from './workspace/state-store.js'

export type ApiActor = { id: string; role: 'author' | 'agent' | 'system' }

export type ApiHandlerOptions = {
  harnessRoot: string
  projectId: string
  resolveActor: (request: Request) => Promise<ApiActor | null>
  stateDirectory?: string
  environment?: 'development' | 'test' | 'production'
  loadProjection?: (root: string, projectId: string) => Promise<HarnessWorkspaceProjection>
}

function json(body: unknown, status = 200, headers: HeadersInit = {}, requestId?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(requestId ? { 'x-request-id': requestId } : {}), ...headers },
  })
}

function problem(status: number, code: string, detail: string, current?: unknown, requestId?: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: code, status, detail, code, ...(current !== undefined ? { current } : {}), ...(requestId ? { requestId } : {}) }), {
    status,
    headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store', ...(requestId ? { 'x-request-id': requestId } : {}) },
  })
}

function requestCorrelationId(request: Request): string {
  const requested = request.headers.get('x-request-id')?.trim()
  return requested && /^[A-Za-z0-9._:-]{1,128}$/.test(requested) ? requested : randomUUID()
}

function decodePathPart(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function requireRole(actor: ApiActor, allowed: ApiActor['role'][]): Response | null {
  return allowed.includes(actor.role) ? null : problem(403, actor.role === 'agent' ? 'AGENT_WRITE_FORBIDDEN' : 'AUTHOR_DECISION_REQUIRED', 'The authenticated actor is not allowed to perform this operation.')
}

function errorResponse(error: unknown, requestId?: string): Response {
  if (error instanceof ChapterNotFoundError) return problem(404, 'NOT_FOUND', error.message, undefined, requestId)
  if (error instanceof DuplicateChapterIdError) return problem(409, 'VALIDATION_FAILED', error.message, { chapterId: error.chapterId, paths: error.paths }, requestId)
  if (error instanceof InvalidChapterSourceError) return problem(422, 'VALIDATION_FAILED', error.message, { chapterId: error.chapterId }, requestId)
  if (error instanceof RevisionConflictError) {
    return problem(409, 'REVISION_CONFLICT', error.message, {
      expectedRevisionId: error.expectedRevisionId,
      currentRevisionId: error.currentRevisionId,
    }, requestId)
  }
  if (error instanceof IdempotencyKeyReuseError) return problem(422, 'VALIDATION_FAILED', error.message, undefined, requestId)
  return problem(500, 'HARNESS_WRITE_FAILED', 'The request could not be completed. No Harness file was written.', undefined, requestId)
}

async function requestJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Fetch-compatible V0.4 Workspace/Chapter routes plus a local read-only diagnostic route. */
export function createApiHandler(options: ApiHandlerOptions): (request: Request) => Promise<Response> {
  const loadProjection = options.loadProjection ?? rebuildHarnessProjection
  const stateDirectory = resolve(options.stateDirectory ?? process.env.WRITER_AGENT_STATE_DIR ?? resolve(homedir(), '.local/share/ai-write-life-circle'))
  const workspaceState = new FileWorkspaceStateStore(stateDirectory)
  const revisions = new FileChapterRevisionStore(stateDirectory)
  const environment = options.environment ?? (process.env.NODE_ENV === 'development' ? 'development' : process.env.NODE_ENV === 'test' ? 'test' : 'production')

  return async (request) => {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json({ status: 'ok', service: 'writer-agent-api' })
    }

    const internalMatch = url.pathname.match(/^\/internal\/projects\/([^/]+)\/harness-projection$/)
    const workspaceMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/workspace$/)
    const chaptersMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/chapters$/)
    const chapterMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/chapters\/([^/]+)$/)
    const revisionsMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/chapters\/([^/]+)\/revisions$/)
    if (!internalMatch && !workspaceMatch && !chaptersMatch && !chapterMatch && !revisionsMatch) {
      return problem(404, 'NOT_FOUND', 'No API route matches this request.')
    }
    if (internalMatch && environment !== 'development') return problem(404, 'NOT_FOUND', 'No API route matches this request.')

    const encodedProjectId = (internalMatch ?? workspaceMatch ?? chaptersMatch ?? chapterMatch ?? revisionsMatch)![1]
    const projectId = decodePathPart(encodedProjectId)
    if (!projectId) return problem(400, 'VALIDATION_FAILED', 'The project ID is not valid URL encoding.')
    if (projectId !== options.projectId) return problem(404, 'NOT_FOUND', 'The configured project does not match this request.')

    const actor = await options.resolveActor(request)
    if (!actor) return problem(401, 'AUTHOR_DECISION_REQUIRED', 'A server-authenticated actor is required.')

    if (internalMatch && request.method === 'GET') {
      const denied = requireRole(actor, ['author', 'agent'])
      if (denied) return denied
      try {
        return json(await loadProjection(options.harnessRoot, projectId))
      } catch (error) {
        return errorResponse(error)
      }
    }

    if (workspaceMatch && (request.method === 'GET' || request.method === 'PATCH')) {
      const denied = requireRole(actor, ['author'])
      if (denied) return denied
      try {
        if (request.method === 'PATCH') {
          const parsed = userWorkspaceStateV04Schema.safeParse(await requestJson(request))
          if (!parsed.success) return problem(422, 'VALIDATION_FAILED', 'The workspace state does not match the V0.4 contract.')
          const saved = await workspaceState.save(projectId, actor.id, parsed.data)
          return json(saved)
        }
        await loadProjection(options.harnessRoot, projectId)
        const dto = workspaceV04Schema.parse({
          project: { projectId },
          userState: await workspaceState.load(projectId, actor.id),
          counts: {},
          runningTasks: [],
        })
        return json(dto)
      } catch (error) {
        return errorResponse(error)
      }
    }

    if (chaptersMatch && request.method === 'GET') {
      const denied = requireRole(actor, ['author', 'agent'])
      if (denied) return denied
      try {
        return json(listHarnessChapters(await loadProjection(options.harnessRoot, projectId)))
      } catch (error) {
        return errorResponse(error)
      }
    }

    if (chapterMatch && !revisionsMatch && request.method === 'GET') {
      const denied = requireRole(actor, ['author', 'agent'])
      if (denied) return denied
      const chapterId = decodePathPart(chapterMatch[2])
      if (!chapterId) return problem(400, 'VALIDATION_FAILED', 'The chapter ID is not valid URL encoding.')
      try {
        const detail = await getHarnessChapter(await loadProjection(options.harnessRoot, projectId), chapterId, projectId, revisions)
        return json(detail, 200, { etag: `"${detail.headRevision.revisionId}"` })
      } catch (error) {
        return errorResponse(error)
      }
    }

    if (revisionsMatch && request.method === 'POST') {
      const requestId = requestCorrelationId(request)
      const chapterId = decodePathPart(revisionsMatch[2])
      if (!chapterId) return problem(400, 'VALIDATION_FAILED', 'The chapter ID is not valid URL encoding.', undefined, requestId)
      const auditBase = {
        actor: { id: actor.id, role: actor.role },
        objectRef: { type: 'chapter', id: chapterId },
        beforeHash: null,
        afterHash: null,
        requestId,
        correlationId: requestId,
      }
      try {
        await appendAuditRecord(stateDirectory, { ...auditBase, action: 'chapter.revision.save_requested' })
      } catch {
        return problem(500, 'AUDIT_WRITE_FAILED', 'The save request could not be audited, so no revision was written.', undefined, requestId)
      }

      const denied = requireRole(actor, ['author'])
      if (denied) {
        try {
          await appendAuditRecord(stateDirectory, { ...auditBase, action: 'chapter.revision.save_failed', failureType: 'permission', result: 'rejected' })
        } catch {
          return problem(500, 'AUDIT_WRITE_FAILED', 'The denied save attempt could not be finalized in the audit log.', undefined, requestId)
        }
        return problem(403, 'AGENT_WRITE_FORBIDDEN', 'Only the author can save chapter prose.', undefined, requestId)
      }

      let parsedMarkdown: string | null = null
      let beforeHash: string | null = null
      try {
        const projection = await loadProjection(options.harnessRoot, projectId)
        const chapter = getUniqueHarnessChapterSource(projection, chapterId)
        const parsed = chapterRevisionCreateV04Schema.safeParse(await requestJson(request))
        if (!parsed.success) {
          await appendAuditRecord(stateDirectory, { ...auditBase, action: 'chapter.revision.save_failed', failureType: 'validation', result: 'invalid_contract_payload' })
          return problem(422, 'VALIDATION_FAILED', 'The chapter revision does not match the V0.4 contract.', undefined, requestId)
        }
        parsedMarkdown = parsed.data.markdown
        const idempotencyKey = request.headers.get('Idempotency-Key') ?? undefined
        if (idempotencyKey !== undefined && idempotencyKey.length > 128) {
          await appendAuditRecord(stateDirectory, { ...auditBase, action: 'chapter.revision.save_failed', failureType: 'validation', result: 'invalid_idempotency_key' })
          return problem(422, 'VALIDATION_FAILED', 'Idempotency-Key must not exceed 128 characters.', undefined, requestId)
        }
        const head = await revisions.getHead(projectId, chapter)
        beforeHash = head.contentHash ?? null
        const saved = await revisions.save(projectId, chapter, { type: actor.role, id: actor.id }, parsed.data, idempotencyKey)
        try {
          await appendAuditRecord(stateDirectory, {
            ...auditBase,
            action: 'chapter.revision.saved',
            beforeHash,
            afterHash: `sha256:${createHash('sha256').update(parsed.data.markdown, 'utf8').digest('hex')}`,
            result: saved.result,
          })
        } catch {
          return problem(500, 'AUDIT_WRITE_FAILED', 'The draft was stored, but its completion audit could not be written. Retry with the same Idempotency-Key.', undefined, requestId)
        }
        return json(saved.revision, saved.status, {}, requestId)
      } catch (error) {
        const isConflict = error instanceof RevisionConflictError
        const isValidation = error instanceof IdempotencyKeyReuseError || error instanceof InvalidChapterSourceError || error instanceof DuplicateChapterIdError
        try {
          await appendAuditRecord(stateDirectory, {
            ...auditBase,
            action: isConflict ? 'chapter.revision.conflict' : 'chapter.revision.save_failed',
            beforeHash,
            afterHash: parsedMarkdown === null ? null : `sha256:${createHash('sha256').update(parsedMarkdown, 'utf8').digest('hex')}`,
            failureType: isConflict ? 'conflict' : error instanceof ChapterNotFoundError ? 'not_found' : isValidation ? 'validation' : 'storage',
            result: isConflict ? 'revision_conflict' : isValidation ? 'validation_failed' : error instanceof ChapterNotFoundError ? 'chapter_not_found' : 'storage_failed',
          })
        } catch {
          return problem(500, 'AUDIT_WRITE_FAILED', 'The save failed and its failure audit could not be written.', undefined, requestId)
        }
        return errorResponse(error, requestId)
      }
    }

    if (revisionsMatch && request.method === 'GET') {
      const denied = requireRole(actor, ['author'])
      if (denied) return denied
      const chapterId = decodePathPart(revisionsMatch[2])
      if (!chapterId) return problem(400, 'VALIDATION_FAILED', 'The chapter ID is not valid URL encoding.')
      try {
        const projection = await loadProjection(options.harnessRoot, projectId)
        const chapter = getUniqueHarnessChapterSource(projection, chapterId)
        const all = await revisions.list(projectId, chapter)
        const rawLimit = Number(url.searchParams.get('limit') ?? '50')
        const offset = Number(url.searchParams.get('cursor') ?? '0')
        if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200 || !Number.isInteger(offset) || offset < 0) {
          return problem(422, 'VALIDATION_FAILED', 'The revision page cursor or limit is invalid.')
        }
        const items = all.slice(offset, offset + rawLimit)
        const nextCursor = offset + items.length < all.length ? String(offset + items.length) : null
        return json({ items, nextCursor, total: all.length })
      } catch (error) {
        return errorResponse(error)
      }
    }

    return problem(404, 'NOT_FOUND', 'No API route matches this method and path.')
  }
}
