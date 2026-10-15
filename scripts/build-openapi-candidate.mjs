import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const sourcePath = fileURLToPath(new URL('../harness/contracts/source/api-spec-v0.4.0-figma-copy.yaml', import.meta.url))
const candidatePath = fileURLToPath(new URL('../harness/contracts/api-spec-v0.4.0-proposed.yaml', import.meta.url))
const source = YAML.parse(await readFile(sourcePath, 'utf8'))

if (source.openapi !== '3.1.0' || source.info?.version !== '0.4.0-proposed') {
  throw new Error('The Figma Make source must be OpenAPI 3.1.0 version 0.4.0-proposed.')
}

const implementedOperationIds = new Set([
  'getWorkspace',
  'updateWorkspaceState',
  'listChapters',
  'getChapter',
  'listChapterRevisions',
  'saveChapterRevision',
])
const summaryFallbacks = {
  listReasoningSessions: 'List reasoning sessions',
  createReasoningSession: 'Create a reasoning session',
  listAgentTasks: 'List agent tasks',
  cancelAgentTask: 'Cancel an agent task',
  retryAgentTask: 'Retry an agent task',
  listProposals: 'List proposals',
  listAudit: 'List audit records',
}
const seenOperationIds = new Set()
const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

for (const pathItem of Object.values(source.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method) || !operation || typeof operation !== 'object') continue
    if (!operation.operationId || seenOperationIds.has(operation.operationId)) {
      throw new Error(`Every operation needs a unique operationId (duplicate/missing: ${operation.operationId ?? 'unknown'}).`)
    }
    seenOperationIds.add(operation.operationId)
    operation['x-implementation-status'] = implementedOperationIds.has(operation.operationId) ? 'implemented' : 'proposed'
    if (!operation.summary && summaryFallbacks[operation.operationId]) operation.summary = summaryFallbacks[operation.operationId]
  }
}

for (const operationId of implementedOperationIds) {
  if (!seenOperationIds.has(operationId)) throw new Error(`Expected implemented operation ${operationId} is missing from the source contract.`)
}

const chapterDetail = source.components?.schemas?.ChapterDetail
const headRevisionOverlay = chapterDetail?.properties?.headRevision?.allOf?.find((schema) => schema.properties)
if (!headRevisionOverlay?.properties?.paragraphs) throw new Error('Expected ChapterDetail.headRevision.paragraphs in source contract.')
delete headRevisionOverlay.properties.paragraphs
headRevisionOverlay.properties.markdown = { type: 'string', description: 'Exact Markdown content; keeps formatting and block structure intact.' }

const chapterRevisionCreate = source.components.schemas.ChapterRevisionCreate
if (!chapterRevisionCreate?.properties?.paragraphs) throw new Error('Expected ChapterRevisionCreate.paragraphs in source contract.')
delete chapterRevisionCreate.properties.paragraphs
chapterRevisionCreate.properties.markdown = {
  type: 'string',
  maxLength: 2097152,
  description: 'TipTap Markdown serialization; preserves paragraph, quote, list, hard-break and inline formatting structure.',
}
chapterRevisionCreate.required = chapterRevisionCreate.required.map((name) => name === 'paragraphs' ? 'markdown' : name)

const problemCodes = source.components.schemas.Problem?.properties?.code?.enum
if (Array.isArray(problemCodes) && !problemCodes.includes('AUDIT_WRITE_FAILED')) problemCodes.push('AUDIT_WRITE_FAILED')

const auditSchema = source.components.schemas.AuditRecord
if (auditSchema?.properties) {
  auditSchema.properties.correlationId = { type: 'string', description: 'Equals requestId for the complete save attempt.' }
  auditSchema.properties.result = { type: 'string' }
  auditSchema.properties.failureType = { type: 'string', enum: ['validation', 'conflict', 'permission', 'storage', 'not_found'] }
}

source['x-source-provenance'] = {
  file: 'Figma Make docs/contracts/api-spec.yaml',
  fileKey: 'kWBOdcae5utBZ6VtBHHXui',
  retrievedAt: '2026-10-14',
  note: 'The Figma MCP resource response was truncated; the complete source copy was supplied in the author reply in this task and preserved under harness/contracts/source/.',
}

const notesExtension = JSON.parse(await readFile(new URL('../harness/contracts/notes-engineering-extension.json', import.meta.url), 'utf8'))
Object.assign(source.paths, notesExtension.paths)
Object.assign(source.components.schemas, notesExtension.schemas)
source.components.schemas.Workspace.properties.capabilities = { $ref: '#/components/schemas/WorkspaceCapabilities' }
source.components.securitySchemes.bearerAuth.description = 'Production: one configured author authenticated by a 256-bit opaque Bearer token over HTTPS; token never comes from query strings or actor headers. Local development identity is development/test only.'
source.tags ??= []
source.tags.push({ name: 'Author Notes', description: 'Informal author application state, isolated from Harness facts.' })
for (const code of ['NOTE_VERSION_CONFLICT', 'NEXT_WRITING_EXISTS', 'METHOD_NOT_ALLOWED']) {
  if (Array.isArray(problemCodes) && !problemCodes.includes(code)) problemCodes.push(code)
}
source['x-notes-extension-provenance'] = notesExtension.provenance

const generated = YAML.stringify(source, { indent: 2, lineWidth: 110 })
if (process.argv.includes('--check')) {
  const existing = await readFile(candidatePath, 'utf8').catch(() => '')
  if (existing !== generated) {
    process.stderr.write('OpenAPI candidate is stale. Run `pnpm openapi:generate` to regenerate it from the versioned source.\n')
    process.exitCode = 1
  }
} else {
  await writeFile(candidatePath, generated, 'utf8')
}
