# Writer Agent API boundary

Sprint 1 implements the proposed V0.4 Workspace and Chapter operations that
can be exercised using the author's approved Harness chapter convention.
The supplied OpenAPI YAML is still a proposed product contract. The Zod
schemas in `packages/contracts/src/v04.ts` are the runtime source for the
implemented subset; their TypeScript types are inferred from those schemas.
They are hand-aligned to the supplied candidate, not generated from an
OpenAPI file. No complete local OpenAPI document or code-generation step is
claimed.

## Implemented routes

- `GET /healthz`
- `GET /internal/projects/:projectId/harness-projection` — local diagnostic,
  read-only Harness projection.
- `GET /v1/projects/:projectId/workspace` — Harness-backed workspace identity
  and restored user state.
- `PATCH /v1/projects/:projectId/workspace` — persist user layout/theme/view
  state outside the Harness.
- `GET /v1/projects/:projectId/chapters` — list only manuscript documents
  with an explicit `CH-*` metadata ID and matching ID-prefixed filename.
- `GET /v1/projects/:projectId/chapters/:chapterId` — current Harness content
  or latest application draft, with an `ETag`.
- `GET /v1/projects/:projectId/chapters/:chapterId/revisions` — immutable
  revision summaries, newest first.
- `POST /v1/projects/:projectId/chapters/:chapterId/revisions` — author-only
  application draft save with `baseRevisionId` compare-and-swap and optional
  `Idempotency-Key`.

The repository currently contains no formal chapter records, so chapter reads
return an empty list until the author creates a Markdown chapter file such as
`manuscript/CH-001.md`. It must start with a level-one title, then ordinary
`Key: value` metadata including `ID: CH-001`, followed by a blank line and
author-written Markdown prose. An optional `volumeId` groups chapters; an
optional positive-integer `order` sorts them within the volume. When omitted,
chapters sort by their numeric CH ID. The filename must begin with the same
chapter ID as the metadata. This follows the author's decision to use the
existing Harness conventions; `templates/chapter.md` remains a planning and
fact-extraction card, not a manuscript template.

The TipTap/editor representation is Markdown at the Harness boundary. The
parser retains the exact raw body and source hash. The editor serializes the
supported Markdown structures and round-trip tests cover Chinese paragraphs,
blank lines, quotations, lists, hard breaks, and special characters. Chapter
saves remain immutable application drafts outside the Harness; the author
separately decides whether and when to write and commit manuscript prose to
Git. When the committed Harness body exactly matches the latest app draft, the
next save continues from a new source baseline while preserving the draft
history. A different external edit remains a 409 conflict. The API does not
allocate a chapter record or rewrite manuscript files.

## Persistence and trust boundary

The local dev server binds to `127.0.0.1` and derives a local author identity.
This is a development-only adapter, not production authentication. Replace
`resolveActor` before deploying or exposing routes beyond loopback. The route
layer enforces author-only saves even when the caller is the Agent.

Workspace state, chapter application drafts, and the append-only audit log are
stored as local JSON files under `WRITER_AGENT_STATE_DIR`, defaulting to
`~/.local/share/ai-write-life-circle`. File locks and atomic rename are a
single-machine Sprint 1 bridge only; this is not a production multi-host or
distributed concurrency guarantee. These are application drafts, not Git
commits. The author separately commits accepted manuscript work to the
Harness. `commitRef` remains `null`; this server does not invoke Git. Save
attempts have correlated requested and terminal audit events; storage and
audit-finalization failures return errors instead of a false saved state.

The complete proposed OpenAPI source copy and the reproducibly generated
candidate are in `docs/contracts/`. OpenAPI operations marked `implemented`
are limited to the Workspace and Chapter subset. The Zod schemas in
`packages/contracts/src/v04.ts` are checked against those request/response
schemas in API tests. The other operations remain `proposed` and are not
implemented.

Each draft is immutable and references its parent revision. A stale
`baseRevisionId`, a duplicate chapter ID, or a divergent external Harness edit
returns a conflict; no write overwrites newer content. If the author commits
the exact current app draft into the Harness, the next save can continue from
that content. Save requests append an audit JSONL record in the application
state directory. Neither chapter nor workspace writes touch `book/`,
`manuscript/`, or `proposals/`.

## Commands

- `pnpm dev:api` — start the local API on port 8787.
- `pnpm harness:rebuild` — print counts and unresolved paths from the
  read-only projection.
- `pnpm openapi:generate` — regenerate the candidate contract from the
  versioned source copy.
- `pnpm openapi:check` / `pnpm openapi:lint` — verify candidate reproducibility
  and OpenAPI 3.1 validity.
- Root `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and
  `pnpm build` include the API package.

No Agent runtime, LLM provider, proposal workflow, or production database is
implemented in Sprint 1 or Sprint 2. The web adapter now uses the implemented
V0.4 Workspace and Chapter routes, with typed DTO mapping and local recovery
for chapter drafts. Knowledge, review, chat, challenge, proposal, and reasoning
routes remain unavailable in API mode. See
`docs/reviews/v0.4-contract-review.md` for open contract decisions and
`docs/reviews/v0.4-sprint2-frontend-integration.md` for the integration scope.
