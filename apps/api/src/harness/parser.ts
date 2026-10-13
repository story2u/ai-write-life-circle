import type { HarnessDocument, HarnessSourceReference, ParsedSection } from './types.js'

const stableIdPattern = /^[A-Z][A-Z0-9]*-\d{1,6}$/
const referencePattern = /\b(?:INTENT|WORLD|CHAR|THREAD|EVENT|CH|P|REF|NOTE|U|C|A|R)-\d{1,6}\b/g

function splitMarkdownSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  let currentHeading: string | null = null
  let currentLines: string[] = []

  const flush = () => {
    const content = currentLines.join('\n').trim()
    if (content || currentHeading) sections.push({ heading: currentHeading, markdown: content })
    currentLines = []
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)
    if (heading) {
      flush()
      currentHeading = heading[1].trim()
      continue
    }
    currentLines.push(line)
  }
  flush()
  return sections
}

function parseSourceReferences(rawSource: string | null, knownPaths: ReadonlySet<string>, hashes: ReadonlyMap<string, string>): HarnessSourceReference[] {
  if (!rawSource?.trim()) return []

  return rawSource.split(/[;；]/).map((part) => {
    const raw = part.trim()
    const match = raw.match(/(?:^|\s|\()((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)(#[^\s;；]*)?/)
    if (!match) return { raw, path: null, locator: null, availability: 'not-a-file-reference', gitBlobHash: null }

    const path = match[1]
    const locator = match[2]?.slice(1) ?? null
    return {
      raw,
      path,
      locator,
      availability: knownPaths.has(path) ? 'available' : 'unresolved',
      gitBlobHash: hashes.get(path) ?? null,
    }
  })
}

function parseRelatedIds(rawRelated: string | undefined): string[] {
  if (!rawRelated) return []
  const matches = rawRelated.match(referencePattern) ?? []
  return [...new Set(matches)]
}

/**
 * Parse this repository's leading `Key: value` metadata convention. YAML
 * front matter is deliberately not assumed or interpreted.
 */
export function parseHarnessMarkdown(input: {
  path: string
  markdown: string
  sha256: string
  gitBlobHash: string
  knownPaths?: ReadonlySet<string>
  hashes?: ReadonlyMap<string, string>
}): HarnessDocument {
  const lines = input.markdown.split(/\r?\n/)
  let cursor = 0
  while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1

  let title: string | null = null
  const firstHeading = lines[cursor]?.match(/^#\s+(.+?)\s*#*$/)
  if (firstHeading) {
    title = firstHeading[1].trim()
    cursor += 1
  }

  const metadata: Record<string, string> = {}
  while (cursor < lines.length) {
    const line = lines[cursor]
    if (line.trim() === '') {
      cursor += 1
      if (Object.keys(metadata).length > 0) break
      continue
    }
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!field) break
    metadata[field[1]] = field[2].trim()
    cursor += 1
  }

  const bodyMarkdown = lines.slice(cursor).join('\n').trim()
  const declaredId = metadata.ID?.trim() ?? metadata.id?.trim() ?? null
  const fileId = input.path.split('/').at(-1)?.match(/^([A-Z][A-Z0-9]*-\d{1,6})(?:[-_.]|$)/)?.[1] ?? null
  const stableId = declaredId && stableIdPattern.test(declaredId) ? declaredId : (fileId && stableIdPattern.test(fileId) ? fileId : null)
  const idSource = stableId ? (declaredId === stableId ? 'metadata' : 'filename') : null
  const referencedIds = [...new Set(bodyMarkdown.match(referencePattern) ?? [])]

  return {
    path: input.path,
    title,
    metadata,
    stableId,
    idSource,
    rawStatus: metadata.status ?? null,
    rawSource: metadata.source ?? null,
    sourceReferences: parseSourceReferences(metadata.source ?? null, input.knownPaths ?? new Set(), input.hashes ?? new Map()),
    declaredRelatedIds: parseRelatedIds(metadata.related),
    referencedIds,
    sections: splitMarkdownSections(bodyMarkdown),
    markdown: input.markdown,
    bodyMarkdown,
    sha256: input.sha256,
    gitBlobHash: input.gitBlobHash,
  }
}
