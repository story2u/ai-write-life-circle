export type ParsedSection = {
  heading: string | null
  markdown: string
}

export type HarnessSourceReference = {
  raw: string
  path: string | null
  locator: string | null
  availability: 'available' | 'unresolved' | 'not-a-file-reference'
  gitBlobHash: string | null
}

/** A read-only view of a Markdown file. `markdown` preserves its decoded source; projections do not infer canon. */
export type HarnessDocument = {
  path: string
  title: string | null
  metadata: Record<string, string>
  stableId: string | null
  idSource: 'metadata' | 'filename' | null
  rawStatus: string | null
  rawSource: string | null
  sourceReferences: HarnessSourceReference[]
  declaredRelatedIds: string[]
  referencedIds: string[]
  sections: ParsedSection[]
  /** Exact decoded file contents, retained for provenance and faithful display. */
  markdown: string
  /** Exact body after the recognized leading key-value header, including original line endings. */
  bodyMarkdown: string
  sha256: string
  gitBlobHash: string
}

export type HarnessIdCollision = {
  id: string
  paths: string[]
}

export type HarnessWorkspaceProjection = {
  projectId: string
  sourceRevision: null
  knowledgeDocuments: HarnessDocument[]
  proposalDocuments: HarnessDocument[]
  chapterDocuments: HarnessDocument[]
  unmappedChapterPaths: string[]
  otherDocuments: HarnessDocument[]
  idCollisions: HarnessIdCollision[]
}
