import { randomUUID } from 'node:crypto'
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export type AuditActor = { id: string; role: 'author' | 'agent' | 'system' }

export type AuditRecord = {
  auditId: string
  at: string
  actor: AuditActor
  action: string
  objectRef: { type: string; id: string }
  beforeHash: string | null
  afterHash: string | null
  requestId: string
  correlationId: string
  result?: string
  failureType?: 'validation' | 'conflict' | 'permission' | 'storage' | 'not_found'
}

export type NewAuditRecord = Omit<AuditRecord, 'auditId' | 'at' | 'correlationId'> & { at?: string; correlationId?: string }

/** Append-only application audit log. The configured directory must be outside Harness source folders. */
export async function appendAuditRecord(stateDirectory: string, input: NewAuditRecord): Promise<AuditRecord> {
  const record: AuditRecord = {
    ...input,
    auditId: randomUUID(),
    at: input.at ?? new Date().toISOString(),
    correlationId: input.correlationId ?? input.requestId,
  }
  await mkdir(stateDirectory, { recursive: true })
  await appendFile(join(stateDirectory, 'audit.jsonl'), `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' })
  return record
}
