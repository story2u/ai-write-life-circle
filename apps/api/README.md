# Writer Agent API boundary

Sprint 1 implements the proposed V0.4 Workspace and Chapter operations that
can be exercised without selecting a database or inventing chapter records.
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
  with an explicit `CH-*` metadata ID.
- `GET /v1/projects/:projectId/chapters/:chapterId` — current Harness content
  or latest application draft, with an `ETag`.
- `GET /v1/projects/:projectId/chapters/:chapterId/revisions` — immutable
  revision summaries, newest first.
- `POST /v1/projects/:projectId/chapters/:chapterId/revisions` — author-only
  application draft save with `baseRevisionId` compare-and-swap and optional
  `Idempotency-Key`.

The repository currently contains no formal chapter records, so chapter reads
return an empty list until an author-created manuscript file has an explicit
`CH-*` ID and title. This code does not allocate chapter IDs or rewrite
manuscript files while OQ-016 remains open.

## Persistence and trust boundary

The local dev server binds to `127.0.0.1` and derives a local author identity.
This is a development-only adapter, not production authentication. Replace
`resolveActor` before deploying or exposing routes beyond loopback. The route
layer enforces author-only saves even when the caller is the Agent.

Workspace state and chapter application drafts are stored as atomic JSON files
under `WRITER_AGENT_STATE_DIR`, defaulting to
`~/.local/share/ai-write-life-circle`. These are application drafts, not Git
commits. The author separately commits accepted manuscript work to the
Harness. `commitRef` remains `null`; this server does not invoke Git.

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
- Root `pnpm typecheck`, `pnpm test`, and `pnpm build` include the API package.

No Agent runtime, LLM provider, proposal workflow, or production database is
implemented in this Sprint 1 slice. The current web adapter still uses the
V0.2/V0.3 client contract; a DTO adapter and screen-level integration remain
follow-up work. See `docs/reviews/v0.4-contract-review.md` for open decisions
and contract limits.
