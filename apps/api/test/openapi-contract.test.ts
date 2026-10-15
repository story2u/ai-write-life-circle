import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import YAML from 'yaml'
import {
  chapterDetailV04Schema,
  chapterListV04Schema,
  chapterRevisionCreateV04Schema,
  chapterRevisionSummaryV04Schema,
  pageV04Schema,
  problemV04Schema,
  userWorkspaceStateV04Schema,
  workspaceV04Schema,
} from '@writer-agent/contracts'
import { describe, expect, it } from 'vitest'
import { createApiHandler } from '../src/http.js'

const contractPath = fileURLToPath(new URL('../../../harness/contracts/api-spec-v0.4.0-proposed.yaml', import.meta.url))
const contract = YAML.parse(await readFile(contractPath, 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string; 'x-implementation-status'?: string; responses?: Record<string, unknown> }>>
  components: { schemas: Record<string, unknown> }
}
const contractId = 'https://writer-agent.test/contracts/v0.4'
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
ajv.addSchema(contract, contractId)

const implementedOperationIds = [
  'getWorkspace',
  'updateWorkspaceState',
  'listChapters',
  'getChapter',
  'listChapterRevisions',
  'saveChapterRevision',
  'listAuthorNotes', 'getAuthorNote', 'createAuthorNote', 'updateAuthorNote',
].sort()

function operationById(operationId: string) {
  for (const pathItem of Object.values(contract.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation.operationId === operationId) return operation
    }
  }
  throw new Error(`Missing OpenAPI operation: ${operationId}`)
}

function operationSchema(operationId: string, status: number): unknown {
  const operation = operationById(operationId)
  const path = Object.entries(contract.paths).find(([, pathItem]) => Object.values(pathItem).includes(operation))?.[0]
  const method = Object.entries(contract.paths[path!]).find(([, candidate]) => candidate === operation)?.[0]
  const pointer = `#/paths/${path!.replaceAll('~', '~0').replaceAll('/', '~1')}/${method}/responses/${status}/content/application~1json/schema`
  return { $ref: `${contractId}${pointer}` }
}

function assertOpenApi(operationId: string, status: number, body: unknown): void {
  const validate = ajv.compile(operationSchema(operationId, status))
  expect(validate(body), `${operationId} response: ${JSON.stringify(validate.errors)}`).toBe(true)
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'writer-openapi-contract-'))
  await mkdir(join(root, 'manuscript'), { recursive: true })
  await writeFile(join(root, 'manuscript', 'CH-001.md'), '# Chapter One\nID: CH-001\nvolumeId: VOL-01\norder: 1\n\n第一段。\n\n> 引用内容。')
  return root
}

describe('versioned OpenAPI contract', () => {
  it('marks every operation implemented or proposed and lists only the implemented Workspace, Chapter and Note routes', () => {
    const operations = Object.values(contract.paths).flatMap((pathItem) => Object.values(pathItem))
    expect(operations.every((operation) => ['implemented', 'proposed'].includes(operation['x-implementation-status'] ?? ''))).toBe(true)
    expect(operations.filter((operation) => operation['x-implementation-status'] === 'implemented').map((operation) => operation.operationId).sort()).toEqual(implementedOperationIds)
  })

  it('keeps the implemented API responses and chapter save body aligned with both OpenAPI and Zod', async () => {
    const root = await fixture()
    let actorRole: 'author' | 'agent' = 'author'
    const handler = createApiHandler({
      harnessRoot: root,
      projectId: 'project-1',
      stateDirectory: join(root, 'app-state'),
      resolveActor: async () => ({ id: `${actorRole}-1`, role: actorRole }),
    })

    const workspaceResponse = await handler(new Request('http://localhost/v1/projects/project-1/workspace'))
    const workspace = await workspaceResponse.json()
    expect(workspaceResponse.status).toBe(200)
    assertOpenApi('getWorkspace', 200, workspace)
    expect(workspaceV04Schema.parse(workspace)).toMatchObject({ project: { projectId: 'project-1' } })

    const updatePayload = { lastView: 'write', theme: 'dark', layout: { focus: true } }
    const updateResponse = await handler(new Request('http://localhost/v1/projects/project-1/workspace', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(updatePayload),
    }))
    const updatedState = await updateResponse.json()
    expect(updateResponse.status).toBe(200)
    expect(userWorkspaceStateV04Schema.parse(updatePayload)).toBeTruthy()
    assertOpenApi('updateWorkspaceState', 200, updatedState)
    expect(userWorkspaceStateV04Schema.parse(updatedState)).toMatchObject(updatePayload)

    const chaptersResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters'))
    const chapters = await chaptersResponse.json()
    expect(chaptersResponse.status).toBe(200)
    assertOpenApi('listChapters', 200, chapters)
    expect(chapterListV04Schema.parse(chapters).volumes[0]?.chapters?.[0]?.chapterId).toBe('CH-001')

    const detailResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001'))
    const detail = await detailResponse.json() as { headRevision: { revisionId: string; markdown: string } }
    expect(detailResponse.status).toBe(200)
    assertOpenApi('getChapter', 200, detail)
    expect(chapterDetailV04Schema.parse(detail).headRevision.markdown).toContain('> 引用内容。')

    const historyResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions'))
    const history = await historyResponse.json()
    expect(historyResponse.status).toBe(200)
    assertOpenApi('listChapterRevisions', 200, history)
    expect(pageV04Schema.parse(history).items).toHaveLength(1)

    const savePayload = { baseRevisionId: detail.headRevision.revisionId, markdown: '作者正文\n\n- 项目符号', trigger: 'manual' }
    const requestValidator = ajv.compile({ $ref: `${contractId}#/components/schemas/ChapterRevisionCreate` })
    expect(requestValidator(savePayload), JSON.stringify(requestValidator.errors)).toBe(true)
    expect(chapterRevisionCreateV04Schema.parse(savePayload)).toMatchObject(savePayload)
    actorRole = 'agent'
    const agentSaveResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'agent-must-not-save' },
      body: JSON.stringify(savePayload),
    }))
    const agentProblem = await agentSaveResponse.json()
    expect(agentSaveResponse.status).toBe(403)
    const problemValidator = ajv.compile({ $ref: `${contractId}#/components/schemas/Problem` })
    expect(problemValidator(agentProblem), JSON.stringify(problemValidator.errors)).toBe(true)
    expect(problemV04Schema.parse(agentProblem).code).toBe('AGENT_WRITE_FORBIDDEN')

    actorRole = 'author'
    const saveResponse = await handler(new Request('http://localhost/v1/projects/project-1/chapters/CH-001/revisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'contract-save' },
      body: JSON.stringify(savePayload),
    }))
    const savedRevision = await saveResponse.json()
    expect(saveResponse.status).toBe(201)
    assertOpenApi('saveChapterRevision', 201, savedRevision)
    expect(chapterRevisionSummaryV04Schema.parse(savedRevision).contentHash).toMatch(/^sha256:/)
  })
})
