# Writer Agent Web

## Demo mode

```sh
pnpm dev
```

The standalone web app starts on `http://127.0.0.1:5173` and uses the replaceable
Demo adapter.

## Local API mode

```sh
pnpm dev:local
```

This starts the local API and Vite together. The default project ID is `local`;
select another one with `VITE_WRITER_AGENT_PROJECT_ID=my-project pnpm dev:local`.
The API reads Harness chapters with stable `CH-*` IDs and stores application
drafts outside the Harness. It does not write Git commits or call an Agent.

For separate processes, run `pnpm dev:api` and `pnpm dev` with
`VITE_WRITER_AGENT_MODE=api`, `VITE_WRITER_AGENT_PROJECT_ID`, and
`WRITER_AGENT_API_TARGET` configured. The Vite development proxy sends `/v1`
requests to the loopback API target.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` from the
repository root to verify the frontend and its API integration.
