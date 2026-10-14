import { resolve } from 'node:path'
import { rebuildHarnessProjection } from './projection.js'

const root = resolve(process.env.WRITER_AGENT_HARNESS_ROOT ?? resolve(process.cwd(), '../..'))
const projectId = process.env.WRITER_AGENT_PROJECT_ID ?? 'local'
const projection = await rebuildHarnessProjection(root, projectId)

process.stdout.write(`${JSON.stringify({
  projectId: projection.projectId,
  markdownDocuments: projection.knowledgeDocuments.length + projection.proposalDocuments.length + projection.chapterDocuments.length + projection.otherDocuments.length,
  knowledgeDocuments: projection.knowledgeDocuments.length,
  proposalDocuments: projection.proposalDocuments.length,
  chapterDocuments: projection.chapterDocuments.length,
  unmappedChapterPaths: projection.unmappedChapterPaths,
  idCollisions: projection.idCollisions,
}, null, 2)}\n`)
