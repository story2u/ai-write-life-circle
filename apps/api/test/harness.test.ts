import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHarnessMarkdown } from '../src/harness/parser.js'
import { rebuildHarnessProjection } from '../src/harness/projection.js'
import { readHarnessDocuments } from '../src/harness/reader.js'

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'writer-agent-api-'))
}

describe('Harness Markdown reader', () => {
  it('reads the repository key-value header without treating it as YAML', () => {
    const document = parseHarnessMarkdown({
      path: 'book/world/WORLD-001.md',
      markdown: '# Two realms\nID: WORLD-001\nstatus: confirmed（部分）\nsource: inbox/source.md#SRC-1\nrelated: INTENT-001, WORLD-002\n\n## Rule\n\n- First rule\n- Second rule',
      sha256: 'sha256:test',
      gitBlobHash: 'git-test',
      knownPaths: new Set(['inbox/source.md']),
      hashes: new Map([['inbox/source.md', 'source-git-hash']]),
    })

    expect(document.title).toBe('Two realms')
    expect(document.stableId).toBe('WORLD-001')
    expect(document.rawStatus).toBe('confirmed（部分）')
    expect(document.sourceReferences).toEqual([{
      raw: 'inbox/source.md#SRC-1',
      path: 'inbox/source.md',
      locator: 'SRC-1',
      availability: 'available',
      gitBlobHash: 'source-git-hash',
    }])
    expect(document.declaredRelatedIds).toEqual(['INTENT-001', 'WORLD-002'])
    expect(document.markdown).toContain('ID: WORLD-001')
    expect(document.bodyMarkdown).not.toContain('ID: WORLD-001')
    expect(document.sections).toEqual([{ heading: 'Rule', markdown: '- First rule\n- Second rule' }])
  })

  it('does not assume YAML front matter or invent a stable ID from it', () => {
    const markdown = '---\nid: WORLD-001\nstatus: confirmed\n---\n# Heading\n\nUnknown stays text.'
    const document = parseHarnessMarkdown({ path: 'book/world/entry.md', markdown, sha256: 'sha256:test', gitBlobHash: 'git-test' })

    expect(document.stableId).toBeNull()
    expect(document.rawStatus).toBeNull()
    expect(document.markdown).toContain('id: WORLD-001')
    expect(document.markdown).toContain('Unknown stays text.')
  })

  it('computes Git blob and SHA-256 hashes and skips symlinks', async () => {
    const root = await temporaryDirectory()
    await mkdir(join(root, 'book', 'world'), { recursive: true })
    await mkdir(join(root, 'inbox'), { recursive: true })
    const source = '# Entry\nID: WORLD-001\n\nBody.'
    await writeFile(join(root, 'book', 'world', 'WORLD-001.md'), source)
    await symlink(join(root, 'inbox'), join(root, 'book', 'external'))

    const documents = await readHarnessDocuments(root)
    expect(documents).toHaveLength(1)
    expect(documents[0].sha256).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(documents[0].gitBlobHash).toMatch(/^[a-f0-9]{40}$/)
  })

  it('rebuilds raw projections without collapsing duplicate IDs or interpreting unknowns', async () => {
    const root = await temporaryDirectory()
    await mkdir(join(root, 'book', 'world'), { recursive: true })
    await mkdir(join(root, 'proposals'), { recursive: true })
    await mkdir(join(root, 'manuscript'), { recursive: true })
    await writeFile(join(root, 'book', 'intent.md'), '# Intent\nID: INTENT-001\nstatus: confirmed\n\n## Core\n\nunknown')
    await writeFile(join(root, 'book', 'world', 'one.md'), '# One\nID: WORLD-001\nstatus: confirmed\n\n## Rule\n\nunknown')
    await writeFile(join(root, 'book', 'world', 'two.md'), '# Two\nID: WORLD-001\nstatus: proposed\n\n## Rule\n\nunknown')
    await writeFile(join(root, 'proposals', 'P-001.md'), '# Proposal\nstatus: partially-accepted\n\nCandidate')
    await writeFile(join(root, 'proposals', 'P-001-bootstrap.md'), '# Bootstrap\nID: P-001\nstatus: proposed\n\nCandidate')
    await writeFile(join(root, 'manuscript', 'chapter.md'), '# Draft\n\nNo chapter ID yet.')

    const projection = await rebuildHarnessProjection(root, 'project-1')
    expect(projection.projectId).toBe('project-1')
    expect(projection.knowledgeDocuments.filter((entry) => entry.stableId === 'WORLD-001')).toHaveLength(2)
    expect(projection.idCollisions).toEqual([
      { id: 'P-001', paths: ['proposals/P-001-bootstrap.md', 'proposals/P-001.md'] },
      { id: 'WORLD-001', paths: ['book/world/one.md', 'book/world/two.md'] },
    ])
    expect(projection.unmappedChapterPaths).toEqual(['manuscript/chapter.md'])
    expect(projection.knowledgeDocuments.find((entry) => entry.stableId === 'WORLD-001')?.rawStatus).toMatch(/confirmed|proposed/)
  })
})
