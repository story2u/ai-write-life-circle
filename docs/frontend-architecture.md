# Frontend and API boundary

`apps/web` contains the React + TypeScript + Vite studio. Visual components live
in `src/components`; workspace workflow orchestration lives in `src/features`
and `src/hooks`; transport adapters live in `src/services`; deterministic demo
fixtures and replies live in `src/mocks`. Components receive data and callbacks
through props and do not call an LLM, Git, or the Markdown Harness.

`packages/contracts` owns Zod-validated request/response shapes shared by web
and API. `apps/api` is reserved for a future server runtime. The web app defaults
to the demo adapter; set `VITE_WRITER_AGENT_MODE=api` to select the HTTP adapter
when an API is available. No Agent runtime or real LLM is part of this setup.

Chapter saves go through `saveChapter` and represent an explicit author save.
Agent endpoints can return review proposals, discussion responses, or challenge
rounds. None of those paths writes chapter prose or updates Harness files.

Commands from the repository root:

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
