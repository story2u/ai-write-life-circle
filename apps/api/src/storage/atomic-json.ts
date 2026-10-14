import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new Error(`Could not read application state at ${path}`, { cause: error })
  }
}

export async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export async function withFileLock<T>(lockPath: string, callback: () => Promise<T>): Promise<T> {
  await mkdir(dirname(lockPath), { recursive: true })
  for (let attempt = 0; attempt < 300; attempt += 1) {
    let lockHandle
    try {
      lockHandle = await open(lockPath, 'wx')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
      continue
    }

    try {
      return await callback()
    } finally {
      await lockHandle.close()
      await unlink(lockPath).catch(() => undefined)
    }
  }
  throw new Error('Timed out waiting for application-state lock')
}
