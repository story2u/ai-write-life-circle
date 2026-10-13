# API boundary

This package reserves the future backend application boundary. It intentionally
does not start an Agent runtime or expose a real LLM provider yet. Define request
and response payloads in packages/contracts.

The web HTTP adapter expects:

- GET /api/projects/:projectId/workspace: server-owned chapters, knowledge,
  chapter documents, and revision/hash metadata.
- POST /api/chapters: an explicit author save with projectId, expected revision,
  and submitted sourceHash. Return the new revision and hash only after
  persistence succeeds. Return HTTP 409 on a stale revision; never overwrite
  newer content.
- POST /api/agent/reviews: echo reviewRunId, project/chapter revision and hash,
  requested scope, completed coverage, evidence validation, and proposals.
- POST /api/agent/chat and /api/agent/challenges: operate only within the
  supplied project context.

Review proposals must remain bound to the exact source version and carry
evidence references. Missing results in a later run do not resolve existing
proposals. Chapter writes remain explicit author saves; Agent endpoints may
inspect chapters and return proposals, but must not generate, overwrite, or
publish chapter prose.
