# Figma UI source

## Authority and source

- File: [Writer Agent UI/UX Design](https://www.figma.com/make/kWBOdcae5utBZ6VtBHHXui/Writer-Agent-UI-UX-Design)
- Type: Figma Make
- File key: `kWBOdcae5utBZ6VtBHHXui`
- Entry node: `0:1`
- The public Make preview/source currently corresponds to the V0.3 prototype; the MCP response does not expose a version field. The V0.4 product documents are marked `draft-for-engineering`, not a final API contract.
- Last read: 2026-10-14 (Asia/Shanghai), using the official remote Figma MCP.
- Official remote endpoint: `https://mcp.figma.com/mcp`
- The Make source is the authority for page structure, interactions, design tokens, typography, assets, and themes.

## MCP access and diagnosis

The shell Codex CLI was `0.159.0`; the Codex Desktop bundled CLI was
`0.162.0-alpha.17.2`. Initially there was no `figma` server in
`~/.codex/config.toml`, and `codex mcp get figma` reported no server. No
`enabled_tools`/`disabled_tools` filter or custom model provider was configured.
The Figma server was registered once at the official remote URL. OAuth login
completed successfully through `codex mcp login figma`.

A fresh CLI session exposed `mcp__figma__get_design_context`,
`mcp__figma__get_screenshot`, and `mcp__figma__get_variable_defs`. The original
Desktop thread kept its stale connector wrapper and still returned
`Unknown tool(figma.get_design_context)`; restart Codex Desktop to refresh that
thread's tool list. This was a tool-routing/reload issue, not a file-permission
denial.

## Read resources and limits

`get_design_context` succeeded for file key `kWBOdcae5utBZ6VtBHHXui`, node
`0:1`, framework `react`, language `typescript`. The returned Make resources
were read through the `figma` remote MCP resource templates. They included the
app entry, React components, source CSS, types, demo data, package metadata,
and image resources. The implementation files are now under `apps/web`.

## 2026-10-14 V0.4 product review

The official remote MCP successfully returned `get_design_context` for node
`0:1`. The review read `docs/README.md`, the product PRD, user journeys and
feature matrix, feature documents, domain model, API spec, state machines,
persistence and permissions, component contracts, screen map, acceptance
criteria, traceability matrix, HANDOFF and implementation plan. It also read
the relevant Make sources: `src/App.tsx`, `src/types.ts`, `src/kb/types.ts`,
`src/kb/data.ts`, `src/kb/route.ts`, `src/reasoning/engine.ts`,
`src/index.css`, and the related architecture/handoff resources.

The API spec resource was returned with an in-body `…6290 tokens truncated…`
marker; the author then supplied the complete proposed YAML in the task reply.
The full text has not been saved as a repository OpenAPI file or run through an
OpenAPI validator. Sprint 1's Workspace/Chapter Zod schemas were hand-aligned
to the supplied operations and are the runtime source for that implemented
subset. Operations marked `proposed` remain non-final. The Make
`get_screenshot` and `get_variable_defs` tools report that they do not support
Make files. A public browser preview was visible and showed the V0.3 workbench;
its source-code panel requested sign-in. No screenshot pixel diff is claimed.
The application draft endpoint is implemented. The author resolved OQ-016 by
confirming the existing Harness conventions for chapter files; no chapter
record exists yet because `manuscript/` contains no authored chapter. The API
does not write Harness files.
The initial API-spec truncation was a resource limit, not a file permission
failure.

The V0.4 PRD is a candidate product spec. Open questions affecting data safety
and authorship are recorded in `docs/reviews/v0.4-contract-review.md`; they are
not silently resolved by the implementation.

## 2026-10-14 Claude product/UX remediation review

The official remote MCP `get_design_context` was used again for the same Make
file and node (`0:1`). The current Make docs/source still describe the V0.3
three-column workbench and four Agent tabs; they do not expose a newer approved
information architecture. This review has no Make version identifier.
`get_screenshot` returned that Make files are unsupported. The browser preview
was not used as a pixel-comparison source during this remediation, so visual
parity for the updated default state is not claimed.

The safe interim frontend adjustment is limited to collapsing the right Agent
panel on first use when no saved layout exists, while preserving saved layout,
chapter navigation, theme and focus-mode behavior. The new product design brief
is `design/writer-agent-ux-vnext-handoff.md`; it is a request for Figma work,
not an approved design or a claim that Figma was updated. The evidence-based
status of the ten review items is recorded in
`docs/reviews/claude-product-ux-remediation.md`.

The Make `get_screenshot` tool explicitly reports that it does not support Make
files. A browser preview of the Make file was available and used for qualitative
desktop comparison; automated/pixel-diff screenshot comparison is not available
through that MCP tool. Three returned PNG resource payloads were truncated and
could not be decoded. The source code does not reference those PNGs; the three
complete PNGs and favicon were retained under `apps/web/public`.

No Figma Make runtime configuration, `.figma/make` directory, or platform-only
plugin was copied into the production app. Figma sync is a manual MCP workflow;
there is no automatic watcher or bidirectional sync.
