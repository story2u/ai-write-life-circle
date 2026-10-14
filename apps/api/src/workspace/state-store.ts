import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { userWorkspaceStateV04Schema, type UserWorkspaceStateV04 } from '@writer-agent/contracts'
import { readJsonFile, withFileLock, writeJsonAtomically } from '../storage/atomic-json.js'

const defaultWorkspaceState: UserWorkspaceStateV04 = {
  lastView: 'write',
  theme: 'light',
  kbRecent: [],
}

const defaultLayout = { leftOpen: true, rightOpen: false, leftW: 280, rightW: 400, focus: false }

function safeKey(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

export class FileWorkspaceStateStore {
  constructor(private readonly stateDirectory: string) {}

  private filePath(projectId: string, actorId: string): string {
    return join(this.stateDirectory, 'workspace', safeKey(projectId), `${safeKey(actorId)}.json`)
  }

  async load(projectId: string, actorId: string): Promise<UserWorkspaceStateV04> {
    const parsed = await readJsonFile(this.filePath(projectId, actorId), defaultWorkspaceState)
    return userWorkspaceStateV04Schema.parse(parsed)
  }

  async save(projectId: string, actorId: string, patch: UserWorkspaceStateV04): Promise<UserWorkspaceStateV04> {
    const path = this.filePath(projectId, actorId)
    return withFileLock(`${path}.lock`, async () => {
      const current = await this.load(projectId, actorId)
      const next = userWorkspaceStateV04Schema.parse({
        ...current,
        ...patch,
        layout: patch.layout ? { ...defaultLayout, ...current.layout, ...patch.layout } : current.layout,
      })
      await mkdir(this.stateDirectory, { recursive: true })
      await writeJsonAtomically(path, next)
      return next
    })
  }
}
