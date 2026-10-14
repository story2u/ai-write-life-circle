import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { parseHarnessMarkdown } from './parser.js'
import type { HarnessDocument } from './types.js'

const sourceDirectories = ['book', 'decisions', 'harness', 'inbox', 'manuscript', 'notes', 'proposals', 'references', 'reviews', 'state', 'templates'] as const
const maxMarkdownBytes = 2 * 1024 * 1024

function gitBlobHash(contents: Buffer): string {
  const header = Buffer.from(`blob ${contents.byteLength}\0`)
  return createHash('sha1').update(header).update(contents).digest('hex')
}

function ensureInsideRoot(root: string, candidate: string): void {
  const rel = relative(root, candidate)
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(candidate) === root) {
    throw new Error('Harness path escapes the configured repository root')
  }
}

async function collectMarkdown(root: string, relativeDirectory: string, output: Array<{ path: string; contents: Buffer }>): Promise<void> {
  const absoluteDirectory = resolve(root, relativeDirectory)
  ensureInsideRoot(root, absoluteDirectory)
  try {
    const directoryStat = await lstat(absoluteDirectory)
    if (!directoryStat.isDirectory()) return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  let entries
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const childRelative = `${relativeDirectory}/${entry.name}`
    const absolutePath = resolve(root, childRelative)
    ensureInsideRoot(root, absolutePath)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      await collectMarkdown(root, childRelative, output)
      continue
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue

    const stat = await lstat(absolutePath)
    if (!stat.isFile() || stat.size > maxMarkdownBytes) continue
    output.push({ path: childRelative.split(sep).join('/'), contents: await readFile(absolutePath) })
  }
}

/** Read only Markdown under known Harness directories. This function never writes. */
export async function readHarnessDocuments(repositoryRoot: string): Promise<HarnessDocument[]> {
  const root = resolve(repositoryRoot)
  const collected: Array<{ path: string; contents: Buffer }> = []
  for (const directory of sourceDirectories) await collectMarkdown(root, directory, collected)

  const files = collected.map(({ path, contents }) => ({
    path,
    contents,
    sha256: `sha256:${createHash('sha256').update(contents).digest('hex')}`,
    gitBlobHash: gitBlobHash(contents),
  }))
  const knownPaths = new Set(files.map((file) => file.path))
  const hashes = new Map(files.map((file) => [file.path, file.gitBlobHash]))

  return files.map((file) => parseHarnessMarkdown({
    path: file.path,
    markdown: file.contents.toString('utf8'),
    sha256: file.sha256,
    gitBlobHash: file.gitBlobHash,
    knownPaths,
    hashes,
  }))
}
