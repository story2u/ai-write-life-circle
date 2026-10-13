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
  loadProjection?: (root: string, projectId: string) => Promise<HarnessWorkspaceProjection>
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

function problem(status: number, code: string, detail: string, current?: unknown): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: code, status, detail, code, ...(current !== undefined ? { current } : {}) }), {
    status,
    headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
  })
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

function errorResponse(error: unknown): Response {
  if (error instanceof ChapterNotFoundError) return problem(404, 'NOT_FOUND', error.message)
  if (error instanceof DuplicateChapterIdError) return problem(409, 'VALIDATION_FAILED', error.message, { chapterId: error.chapterId, paths: error.paths })
  if (error instanceof InvalidChapterSourceError) return problem(422, 'VALIDATION_FAILED', error.message, { chapterId: error.chapterId })
  if (error instanceof RevisionConflictError) {
    return problem(409, 'REVISION_CONFLICT', error.message, {
      expectedRevisionId: error.expectedRevisionId,
      currentRevisionId: error.currentRevisionId,
    })
  }
  if (error instanceof IdempotencyKeyReuseError) return problem(422, 'VALIDATION_FAILED', error.message)
  return problem(500, 'HARNESS_WRITE_FAILED', 'The request could not be completed. No Harness file was written.')
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

    if (revisionsMatch && (request.method === 'GET' || request.method === 'POST')) {
      const denied = requireRole(actor, request.method === 'POST' ? ['author'] : ['author'])
      if (denied) return denied
      const chapterId = decodePathPart(revisionsMatch[2])
      if (!chapterId) return problem(400, 'VALIDATION_FAILED', 'The chapter ID is not valid URL encoding.')
      try {
        const projection = await loadProjection(options.harnessRoot, projectId)
        const chapter = getUniqueHarnessChapterSource(projection, chapterId)

        if (request.method === 'GET') {
          const all = await revisions.list(projectId, chapter)
          const rawLimit = Number(url.searchParams.get('limit') ?? '50')
          const offset = Number(url.searchParams.get('cursor') ?? '0')
          if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200 || !Number.isInteger(offset) || offset < 0) {
            return problem(422, 'VALIDATION_FAILED', 'The revision page cursor or limit is invalid.')
          }
          const items = all.slice(offset, offset + rawLimit)
          const nextCursor = offset + items.length < all.length ? String(offset + items.length) : null
          return json({ items, nextCursor, total: all.length })
        }

        const parsed = chapterRevisionCreateV04Schema.safeParse(await requestJson(request))
        if (!parsed.success) return problem(422, 'VALIDATION_FAILED', 'The chapter revision does not match the V0.4 contract.')
        const idempotencyKey = request.headers.get('Idempotency-Key') ?? undefined
        if (idempotencyKey !== undefined && idempotencyKey.length > 128) {
          return problem(422, 'VALIDATION_FAILED', 'Idempotency-Key must not exceed 128 characters.')
        }
        const head = await revisions.getHead(projectId, chapter)
        await appendAuditRecord(stateDirectory, {
          actor: { id: actor.id, role: actor.role },
          action: 'chapter.revision.save_requested',
          objectRef: { type: 'chapter', id: chapterId },
          beforeHash: head.contentHash ?? null,
          afterHash: `sha256:${createHash('sha256').update(JSON.stringify(parsed.data.paragraphs)).digest('hex')}`,
          requestId: idempotencyKey ?? randomUUID(),
        })
        const saved = await revisions.save(projectId, chapter, { type: actor.role, id: actor.id }, parsed.data, idempotencyKey)
        return json(saved.revision, saved.status)
      } catch (error) {
        return errorResponse(error)
      }
    }

    return problem(404, 'NOT_FOUND', 'No API route matches this method and path.')
  }
}
