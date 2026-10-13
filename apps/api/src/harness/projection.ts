import { readHarnessDocuments } from './reader.js'
import type { HarnessDocument, HarnessIdCollision, HarnessWorkspaceProjection } from './types.js'

function groupCollisions(documents: HarnessDocument[]): HarnessIdCollision[] {
  const pathsById = new Map<string, string[]>()
  for (const document of documents) {
    if (!document.stableId) continue
    const paths = pathsById.get(document.stableId) ?? []
    paths.push(document.path)
    pathsById.set(document.stableId, paths)
  }
  return [...pathsById.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([id, paths]) => ({ id, paths: paths.sort() }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function isIndexDocument(path: string): boolean {
  return path.endsWith('/index.md') || path === 'book/index.md'
}

/** Rebuild the read-only projection from the current Markdown files. */
export async function rebuildHarnessProjection(repositoryRoot: string, projectId: string): Promise<HarnessWorkspaceProjection> {
  const documents = await readHarnessDocuments(repositoryRoot)
  const candidateDocuments = documents.filter((document) => document.stableId)
  const knowledgeDocuments = candidateDocuments.filter((document) => document.path.startsWith('book/') && !isIndexDocument(document.path))
  const proposalDocuments = candidateDocuments.filter((document) => document.path.startsWith('proposals/'))
  const chapterFiles = documents.filter((document) => document.path.startsWith('manuscript/'))
  const chapterDocuments = chapterFiles.filter((document) => document.stableId)
  const otherDocuments = documents.filter((document) =>
    !knowledgeDocuments.includes(document) && !proposalDocuments.includes(document) && !chapterDocuments.includes(document),
  )

  // Keep duplicate IDs as separate path-addressed records; never choose a winner.
  return {
    projectId,
    sourceRevision: null,
    knowledgeDocuments,
    proposalDocuments,
    chapterDocuments,
    unmappedChapterPaths: chapterFiles.filter((document) => !document.stableId).map((document) => document.path).sort(),
    otherDocuments,
    idCollisions: groupCollisions(candidateDocuments),
  }
}
