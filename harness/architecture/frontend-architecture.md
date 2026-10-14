# Frontend and API boundary

The React + TypeScript + Vite studio lives in apps/web. Visual components live in
src/components; workspace workflow orchestration lives in src/features and
src/hooks; transport adapters live in src/services; deterministic fixtures and
responses live in src/mocks. Components receive data and callbacks through props
and do not call an LLM, Git, or the Markdown Harness.

packages/contracts owns Zod-validated request and response shapes shared by web
and API. apps/api is reserved for a future server runtime. The web app defaults
to the Demo adapter; set VITE_WRITER_AGENT_MODE=api and
VITE_WRITER_AGENT_PROJECT_ID to load a selected workspace from the HTTP API.
API mode does not read the Demo workspace from localStorage or import Demo
fixtures. Demo mode alone persists its replaceable workspace in localStorage.

Chapter saves include project ID, expected revision, and SHA-256 source hash.
The client serializes saves per chapter, keeps edits dirty after failures, and
only shows success after a matching API response. A revision conflict is
surfaced and is never retried by overwriting the newer server version.

Review requests and proposals carry a run ID, chapter revision, source hash,
scope, coverage, and evidence references. A result is discarded if the chapter
changes during review. Absence from a later review never resolves an earlier
finding; only an explicitly reappearing finding can reopen a resolved item.
Evidence validation and incomplete coverage are recorded in the response.

Agent endpoints can return review proposals, discussion responses, or challenge
rounds. None of those paths writes chapter prose or updates Harness files. The
API runtime is still a placeholder; no Agent runtime or real LLM is included.

GitHub Actions runs typecheck, lint, unit tests, production build, and Playwright
visual smoke checks at a 1440×900 viewport for light, dark, and focus mode. The
checks save screenshots as PR artifacts; they do not compare against a pixel
baseline.

Run from the repository root:

- pnpm install
- pnpm dev
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm test:e2e
- pnpm build
