# V0.4 API contract artifacts

- `source/api-spec-v0.4.0-figma-copy.yaml` preserves the complete author-supplied
  Figma Make OpenAPI 3.1.0 candidate without edits. The MCP resource response
  was truncated; see `source/README.md` for provenance.
- `api-spec-v0.4.0-proposed.yaml` is generated reproducibly from that copy. It
  adds an explicit `x-implementation-status` to every operation and records
  Sprint 1's Markdown and audit-field alignment.
- `pnpm openapi:generate` regenerates the candidate. `pnpm openapi:check`
  fails if the checked-in candidate is stale. `pnpm openapi:lint` validates the
  document with the pinned Redocly CLI.

Only `getWorkspace`, `updateWorkspaceState`, `listChapters`, `getChapter`,
`listChapterRevisions`, and `saveChapterRevision` are implemented. All other
operations are marked `proposed`; they are not route support or approved
product behavior. `apps/api/test/openapi-contract.test.ts` exercises the six
implemented operations and validates their responses against both OpenAPI and
the runtime Zod schemas in `packages/contracts/src/v04.ts`.

The source spec's chapter revision payload used `paragraphs[]`. That shape
cannot preserve Markdown block and formatting information, so the generated
candidate uses exact `markdown` strings for chapter responses and saves, with
the same 2 MiB bound as the runtime schema. The generated audit schema also
describes correlation and terminal outcome fields used by Sprint 1.

This is a proposed API contract and an implementation comparison, not a
generated server, complete API implementation, or Figma listener. Figma MCP
currently does not expose a complete resource response for the original YAML
in this task, so future refreshes must compare the new complete Make resource
with the preserved source before updating it.
