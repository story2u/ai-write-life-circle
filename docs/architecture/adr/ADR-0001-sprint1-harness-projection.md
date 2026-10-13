# ADR-0001: Sprint 1 Harness projection and application state

- Status: accepted for Sprint 1
- Date: 2026-10-14
- Context: `origin/main` at `9f5397f318b61d21248b079462150bed57eabd1c`

## Context

Figma Make's V0.4 documents are a candidate product contract. The API spec
resource returned by MCP was truncated; the author supplied its full proposed
YAML in the task. Its implemented Workspace/Chapter subset has Zod runtime
schemas in `packages/contracts/src/v04.ts`, with TypeScript types inferred from
those schemas. The candidate is not checked into the repository as an OpenAPI
file and no full-spec validator or generator is claimed.

The author resolved OQ-015: a chapter save creates an immutable application
draft; the author later commits to Git separately. The author also resolved
OQ-016 on 2026-10-14 by asking to follow existing Harness conventions. Chapter
sources use Markdown + Git, a stable `CH-*` ID in leading key-value metadata,
an ID-prefixed filename, a level-one title, and optional `volumeId` / positive
integer `order` metadata. TipTap content is represented as Markdown at the
Harness boundary. The repository has no formal manuscript chapter. OQ-014
(database/search) and OQ-026 (production deployment/auth) are also open.
Existing Harness rules prohibit Agent writes to chapter prose or unapproved
canon.

## Decision

Read Harness Markdown through an allowlisted, symlink-skipping reader. Preserve
raw source and hashes, retain duplicate IDs as separate paths, and rebuild the
projection from the current files. Expose only the Workspace and Chapter
operations whose behavior does not require choosing a database. Workspace
preferences and immutable chapter drafts use atomic
JSON files in an application state directory outside the Harness.

Chapter saves require an explicit author actor, a current `baseRevisionId`, and
an optional idempotency key. The API returns 409 on a stale revision, duplicate
chapter ID, or divergent external edit. It never invokes Git. The local dev
server binds to loopback and supplies a development-only author identity; a
production authentication adapter is still required.

The ID reservation and append-only audit modules remain small primitives.
There is no database, Agent runtime, knowledge writer, Git writer, or proposal
decision workflow in this slice.

## Consequences

- Harness reads and projection rebuilds do not change source files.
- Chapter endpoints return no chapter records until an author-created source
  file follows the approved Markdown metadata and ID-prefixed filename
  convention. The current repository has no formal chapter file.
- Application draft saves and author Git commits are separate events;
  `commitRef` remains null and drafts are not presented as Harness commits.
- JSON-file storage is local Sprint 1 infrastructure, not a production
  multi-instance persistence choice.
- The existing frontend still consumes V0.2/V0.3 DTOs; UI/API migration needs
  a deliberate DTO mapper and the still-unresolved screens from Figma.
