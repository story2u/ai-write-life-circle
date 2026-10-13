# Figma synchronization log

## 2026-10-12 — MCP route repair and V0.2 source sync

- Source: Writer Agent UI/UX Design, Figma Make, key `kWBOdcae5utBZ6VtBHHXui`, node `0:1`.
- Root cause: the local Codex config had no Figma server, while the existing Desktop thread also retained a stale `figma.get_design_context` wrapper. The error occurred before a file request.
- Registered the official remote MCP endpoint once at `https://mcp.figma.com/mcp`, completed OAuth, and confirmed the exposed `mcp__figma__get_design_context`, `mcp__figma__get_screenshot`, and `mcp__figma__get_variable_defs` tools in a fresh CLI session.
- `get_design_context` succeeded with React and TypeScript parameters. Read the Make source resources, including the studio entry, component files, tokens, types, demo data, and resource links. The Make UI showed Version 3.
- Synced the three-column writing workbench, chapter navigator, TipTap editor and annotations, review panel, chat, challenge workflow, proposal details, knowledge/evidence drawers, decision history, resizable/collapsible panels, focus mode, keyboard controls, and light/dark themes into `apps/web`.
- Kept the Figma CSS tokens and styling values. Replaced only Make-specific build/runtime configuration with standard Vite + Tailwind configuration. Refactored demo workflows behind service adapters, added shared Zod contracts, and reserved `apps/api` for future backend work.
- Qualitative browser comparison against the Figma Make preview confirmed the workbench structure, typography, content column, tokens, and panel layout. The Make MCP screenshot endpoint reports that Make files are unsupported, so no automated pixel diff was possible.
- Three PNG payloads were truncated during resource retrieval; source code did not reference those images. Three complete PNGs and the favicon were copied. No manuscript, book, proposal, decision, or Harness data file was changed.
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (8 tests), and `pnpm build` passed. The production build emits a chunk-size advisory for the combined React/Tiptap bundle.
- Desktop tool discovery still requires a Codex restart; the fresh CLI session already proved remote registration and source access.
