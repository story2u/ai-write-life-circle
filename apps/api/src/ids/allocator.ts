import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type IdInventory = {
  ids: string[]
  collisions: string[]
}

export type IdInventoryLoader = () => Promise<IdInventory>

export class IdAllocationBlockedError extends Error {
  readonly code = 'ID_ALLOCATION_BLOCKED'

  constructor(readonly prefix: string, reason: string) {
    super(`Cannot allocate ${prefix} ID: ${reason}`)
    this.name = 'IdAllocationBlockedError'
  }
}

type ReservationFile = { nextByPrefix: Record<string, number> }

const blockedUntilAuthorResolution = new Map<string, string>([
  ['CH', 'chapter ID and ordering rules remain unresolved (OQ-016)'],
  ['INTENT', 'INTENT-001 is a fixed singleton, not a generated sequence'],
])

async function readReservations(path: string): Promise<ReservationFile> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<ReservationFile>
    return { nextByPrefix: parsed.nextByPrefix ?? {} }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { nextByPrefix: {} }
    throw new Error('ID reservation file is invalid; refusing to guess sequence state', { cause: error })
  }
}

async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx')
      return async () => {
        await handle.close()
        await unlink(lockPath).catch(() => undefined)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
    }
  }
  throw new Error('Timed out waiting for the ID reservation lock')
}

function highestAllocatedNumber(prefix: string, ids: string[]): number {
  return ids.reduce((highest, id) => {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`))
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

/**
 * Reserve an ID in application state only. This does not create or modify a
 * Harness record. Colliding prefixes are disabled until an author resolves them.
 */
export class FileIdAllocator {
  constructor(private readonly stateDirectory: string, private readonly loadInventory: IdInventoryLoader) {}

  async reserve(prefix: string): Promise<string> {
    if (!/^[A-Z][A-Z0-9]*$/.test(prefix)) throw new Error('ID prefix must be uppercase alphanumeric')
    const policyBlock = blockedUntilAuthorResolution.get(prefix)
    if (policyBlock) throw new IdAllocationBlockedError(prefix, policyBlock)

    await mkdir(this.stateDirectory, { recursive: true })
    const reservationsPath = join(this.stateDirectory, 'id-reservations.json')
    const release = await acquireLock(join(this.stateDirectory, 'id-reservations.lock'))
    try {
      const inventory = await this.loadInventory()
      if (inventory.collisions.some((id) => id.startsWith(`${prefix}-`))) {
        throw new IdAllocationBlockedError(prefix, 'existing records contain a duplicate stable ID in this prefix')
      }

      const reservations = await readReservations(reservationsPath)
      const previous = reservations.nextByPrefix[prefix] ?? 0
      const next = Math.max(previous, highestAllocatedNumber(prefix, inventory.ids)) + 1
      reservations.nextByPrefix[prefix] = next

      const temporaryPath = `${reservationsPath}.${randomUUID()}.tmp`
      await writeFile(temporaryPath, JSON.stringify(reservations, null, 2), { flag: 'wx' })
      await rename(temporaryPath, reservationsPath)
      return `${prefix}-${String(next).padStart(3, '0')}`
    } finally {
      await release()
    }
  }
}
