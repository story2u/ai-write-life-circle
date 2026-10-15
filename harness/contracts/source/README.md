# V0.4 contract source

`api-spec-v0.4.0-figma-copy.yaml` is the complete OpenAPI 3.1.0 candidate from Figma Make `docs/contracts/api-spec.yaml`. The Figma MCP resource response contained a truncation marker in the middle of the file; the complete copy came from the author's reply in this task and was saved without edits.

`pnpm openapi:generate` derives `../api-spec-v0.4.0-proposed.yaml` from that source. The derived candidate adds `x-implementation-status` to every operation, changes chapter revision bodies from lossy `paragraphs[]` to lossless `markdown`, and documents audit correlation fields. `implemented` means an API route exists in `apps/api`; every other operation remains `proposed`.
