export class RevisionConflictError extends Error {
  readonly status = 409
  readonly code = 'REVISION_CONFLICT'

  constructor(readonly expectedRevisionId: string | null, readonly currentRevisionId: string | null) {
    super('The chapter revision changed before this save. Reload or compare before retrying.')
    this.name = 'RevisionConflictError'
  }
}

/** Compare-and-swap guard shared by future chapter and mutable-resource adapters. */
export function assertExpectedRevision(currentRevisionId: string | null, expectedRevisionId: string | null): void {
  if (currentRevisionId !== expectedRevisionId) {
    throw new RevisionConflictError(expectedRevisionId, currentRevisionId)
  }
}
