# Shared API contracts and source artifacts

The current business API implements ten operations: getWorkspace,
updateWorkspaceState, listChapters, getChapter, listChapterRevisions,
saveChapterRevision, listAuthorNotes, getAuthorNote, createAuthorNote,
updateAuthorNote. Every other operation remains proposed.

## Sources and generation

- `source/api-spec-v0.4.0-figma-copy.yaml` preserves the complete earlier
  author-supplied Figma Make OpenAPI 3.1 source without edits.
- `source/api-spec-vnext-export-2026-10-14.yaml` preserves the newly supplied
  VNext export. YAML parsing confirms it is semantically equal to the old copy.
- `api-spec-v0.4.0-proposed.yaml` is generated from the old source plus the
  agreed Markdown/audit alignment and the separately authorized Notes extension.
- `notes-engineering-extension.json` is generated from the shared Zod Note
  schemas by `scripts/build-notes-openapi.mts`, then merged by the candidate
  generator. It records engineering provenance and author-only operations.

Run `pnpm openapi:generate`, `pnpm openapi:check` and `pnpm openapi:lint` for
reproducibility and OpenAPI validation. Source copies are never generated over.
API contract tests validate the implemented requests/responses against both
OpenAPI and Zod. Shared TypeScript types are inferred from Zod; no `as any`
transport conversion is required.

## Markdown and note boundaries

Chapter DTOs use exact Markdown instead of the proposed source's paragraphs[];
this preserves block structure and formatting, with the existing 2 MiB limit,
immutable revisions, baseRevisionId, idempotency and correlated audit outcomes.

NoteCreate contains content, optional nullable chapterId and purpose.
NoteUpdate contains the full editable fields plus baseVersion and status.
AuthorNote adds server ID, project, version, author and UTC timestamps. POST and
PATCH require Idempotency-Key; PATCH also applies optimistic locking. Stale
updates return NOTE_VERSION_CONFLICT; a second active plan returns
NEXT_WRITING_EXISTS. Archived notes can be restored; no permanent delete route
is provided. See [ADR-0002](../architecture/adr/ADR-0002-vnext-author-notes.md).

Workspace includes optional server-owned capabilities. Notes is implemented;
knowledge, annotations, canonChanges and agentRuntime are false. Missing flags
from an older server disable the new UI instead of triggering a Demo fallback.
Advanced VNext UI models live in the Demo presentation layer and are not final
production DTOs or approved formal knowledge models.
