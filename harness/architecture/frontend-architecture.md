# Frontend and API boundary

The React + TypeScript + Vite studio lives in `apps/web`. Visual components live
in `src/components`; workspace workflow orchestration lives in `src/features`
and `src/hooks`; transport adapters live in `src/services`; deterministic
fixtures and responses live in `src/mocks`. Components do not call an LLM, Git,
or the Markdown Harness.

`packages/contracts` owns Zod-validated request and response shapes shared by
the web app and API. The web app has two explicit modes:

- Demo mode is the default. It uses replaceable mock services and the existing
  Demo workspace storage in `localStorage`.
- API mode requires `VITE_WRITER_AGENT_PROJECT_ID`. It loads the project,
  chapter list, chapter detail, and revisions from the implemented V0.4 API.
  It does not seed or fall back to Demo data.

The HTTP adapter currently calls only these implemented routes:

- `GET /v1/projects/:projectId/workspace`
- `PATCH /v1/projects/:projectId/workspace`
- `GET /v1/projects/:projectId/chapters`
- `GET /v1/projects/:projectId/chapters/:chapterId`
- `GET /v1/projects/:projectId/chapters/:chapterId/revisions`
- `POST /v1/projects/:projectId/chapters/:chapterId/revisions`

The chapter DTO mapper keeps API `revisionId`, `parentRevisionId`, and
`contentHash` opaque. It never converts them to the numeric Demo revision
counter. Workspace layout and theme updates are sent through the Workspace
PATCH adapter; manuscript content is sent as Markdown with the loaded
`baseRevisionId` and an `Idempotency-Key`.

For API mode, chapter edits are first kept as a project-and-chapter-scoped
browser recovery draft. Network failures preserve the draft and retry the same
request with the same idempotency key. A confirmed save clears the local copy
only after the API response. A 409 revision conflict blocks retries that could
overwrite a newer server version. The author can export the local Markdown or
explicitly confirm reloading the server copy. On refresh, a different local
draft is offered for recovery; an exact match with the server is cleared.

V0.4 agent review, chat, challenge, knowledge, source, issue, proposal, and
reasoning endpoints are not implemented. API mode displays an unavailable
state and makes no calls to those routes. Demo mode continues to demonstrate
the prototype flows with clearly labeled Demo responses. This Sprint does not
add Agent Runtime, LLM calls, formal knowledge writes, or Harness mutations.

The API server is a local development adapter. It binds to loopback and its
local author identity is not production authentication. Application drafts
remain separate from Git/Harness commits; the author decides whether and when
to commit manuscript Markdown to the Harness.

## Run locally

From the repository root:

- `pnpm install`
- `pnpm dev` — Demo mode at `http://127.0.0.1:5173`.
- `pnpm dev:local` — local API and API-backed web app, default project ID
  `local`.
- `VITE_WRITER_AGENT_PROJECT_ID=my-project pnpm dev:local` — select a project.
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

API mode shows only chapters projected from Harness Markdown with explicit
stable `CH-*` IDs. The end-to-end suite uses isolated fixtures under
`apps/web/e2e/fixtures/harness` and a temporary application state directory;
it does not modify the repository's manuscript or Harness data.
