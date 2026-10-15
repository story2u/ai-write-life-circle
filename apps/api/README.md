# Writer Agent local API

The Fetch-compatible API reads a configured Markdown Harness and stores
application drafts/state independently. It never writes Harness Markdown or
runs Git or an LLM. The local server listens on 127.0.0.1 and derives a local
author identity; this identity is not production authentication. The development
entry refuses NODE_ENV=production until a production identity adapter exists.

## Implemented business routes

- GET /v1/projects/:projectId/workspace — project, user preferences and server capabilities.
- PATCH /v1/projects/:projectId/workspace — application preferences.
- GET /v1/projects/:projectId/chapters — ordered, stable-ID chapter tree.
- GET /v1/projects/:projectId/chapters/:chapterId — exact Markdown and head revision.
- GET /v1/projects/:projectId/chapters/:chapterId/revisions — immutable revision lineage.
- POST /v1/projects/:projectId/chapters/:chapterId/revisions — author draft save.
- GET /v1/projects/:projectId/notes — author notes, including archived items.
- GET /v1/projects/:projectId/notes/:noteId — author note detail.
- POST /v1/projects/:projectId/notes — create a non-canon note.
- PATCH /v1/projects/:projectId/notes/:noteId — edit/archive/restore with baseVersion.

GET /healthz is a health probe. The /internal/projects/:projectId/harness-projection
diagnostic route is read-only and available only in development.

Chapter reads allow author/agent; draft saves, revision history, workspace and
all Note operations require a server-authenticated author. The configured
project ID is checked before any operation. New writes validate strict shared
Zod payloads and return Problem Details errors.

## Chapter and author safety

Only manuscript Markdown with a level-one title, matching CH-* filename and
leading ID metadata is projected. Optional volumeId and positive order fields
organize it; missing order falls back to stable chapter ID ordering. The
repository currently has no formal chapters; supply a separate author Harness
through WRITER_AGENT_HARNESS_ROOT. No demo prose is imported into API projects.

Draft writes use baseRevisionId compare-and-swap and Idempotency-Key. Original
Markdown, source hash and immutable parents are retained. Exact app content
later committed by the author is adopted as a new Harness baseline; divergent
external changes return 409. The API does not commit drafts to Git.

## Notes and persistence

WRITER_AGENT_STATE_DIR defaults to ~/.local/share/ai-write-life-circle.
Workspace, chapter drafts and notes use encoded project paths, file locks and
atomic rename for single-machine use. Notes, successful replay results and
success audit records commit together in notes/<encoded-project>.json. Note
updates require baseVersion, and both POST/PATCH require Idempotency-Key.
Stale edits cannot overwrite a newer note. Archive is reversible.

Only one active next_writing note is allowed per project; an existing plan must
be explicitly edited or archived. Notes remain author ideas and never become
formal knowledge. Chapter association is validated against real Harness IDs.
Storage failures return errors instead of reporting success.

Workspace declares notes=true, knowledge/annotations/canonChanges/agentRuntime=false.
Real review, knowledge query, source viewer, story judgment, canon application
and persistent thinking sessions are not implemented. Production identity,
database and distributed coordination remain separate work.

## Verification and local use

Run pnpm dev:api or pnpm dev:local. The root typecheck, lint, test, build and
E2E commands include this package. OpenAPI source copies and generated status
are in harness/contracts; pnpm openapi:check and pnpm openapi:lint verify them.
pnpm harness:rebuild rebuilds a read-only projection. API/E2E tests use isolated
fixtures and temporary state, including role, validation, storage, restart,
idempotency, note concurrency and manuscript conflict scenarios.
