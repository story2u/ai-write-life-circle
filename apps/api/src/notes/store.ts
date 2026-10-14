import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { authorNoteSchema, type AuthorNote, type NoteCreate, type NoteUpdate } from '@writer-agent/contracts'
import { readJsonFile, withFileLock, writeJsonAtomically } from '../storage/atomic-json.js'

export class NoteError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
type NoteState = {
  items: AuthorNote[]
  requests: Record<string, { fingerprint: string; result: AuthorNote }>
  audit: { actorId: string; noteId: string; action: 'created' | 'updated'; version: number; at: string }[]
}

/** Notes, replay results and their audit commit in one locked, atomic transaction. */
export class FileNoteStore {
  constructor(private readonly directory: string) {}
  private path(projectId: string) { return join(this.directory, 'notes', `${Buffer.from(projectId).toString('base64url')}.json`) }
  private async load(projectId: string): Promise<NoteState> {
    const state = await readJsonFile<NoteState>(this.path(projectId), { items: [], requests: {}, audit: [] })
    state.items.forEach((item) => authorNoteSchema.parse(item))
    return state
  }
  async list(projectId: string) { return (await this.load(projectId)).items }
  async mutate(projectId: string, actorId: string, key: string, input: NoteCreate | NoteUpdate, noteId?: string): Promise<AuthorNote> {
    const path = this.path(projectId)
    return withFileLock(`${path}.lock`, async () => {
      const state = await this.load(projectId)
      // Keys are actor-scoped, encoded to avoid prototype-property collisions.
      const replayKey = Buffer.from(JSON.stringify([actorId, key])).toString('base64url')
      const fingerprint = JSON.stringify([noteId ?? null, input])
      const prior = state.requests[replayKey]
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new NoteError(422, 'VALIDATION_FAILED', 'Idempotency-Key was used with different note content.')
        return prior.result
      }
      const current = noteId ? state.items.find((item) => item.noteId === noteId) : undefined
      if (noteId && !current) throw new NoteError(404, 'NOT_FOUND', 'Note not found.')
      if (current && (!('baseVersion' in input) || input.baseVersion !== current.version)) {
        throw new NoteError(409, 'NOTE_VERSION_CONFLICT', '笔记已在其他位置更新；当前输入已保留，请读取最新笔记后再决定。')
      }
      if (input.purpose === 'next_writing' && (!('status' in input) || input.status === 'active') && state.items.some((item) => item.noteId !== noteId && item.purpose === 'next_writing' && item.status === 'active')) {
        throw new NoteError(409, 'NEXT_WRITING_EXISTS', '已有“下次要写”笔记，请先编辑或归档原计划。')
      }
      const at = new Date().toISOString()
      const note: AuthorNote = {
        noteId: current?.noteId ?? randomUUID(), projectId,
        content: input.content, chapterId: input.chapterId, purpose: input.purpose,
        status: 'status' in input ? input.status : 'active', version: (current?.version ?? 0) + 1,
        createdAt: current?.createdAt ?? at, updatedAt: at, createdBy: current?.createdBy ?? actorId,
      }
      state.items = current ? state.items.map((item) => item.noteId === note.noteId ? note : item) : [...state.items, note]
      state.requests[replayKey] = { fingerprint, result: note }
      state.audit.push({ actorId, noteId: note.noteId, action: current ? 'updated' : 'created', version: note.version, at })
      await writeJsonAtomically(path, state)
      return note
    })
  }
}
