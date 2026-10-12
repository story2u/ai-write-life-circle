# Figma-to-frontend synchronization workflow

Use this as the manual `/sync-figma` workflow. It does not install an automatic
watcher or provide bidirectional synchronization.

1. Check `git status`, the current branch, and applicable `AGENTS.md` rules.
   Work in an isolated feature branch/worktree. Preserve author changes and do
   not touch `manuscript/`, `book/`, `proposals/`, or `decisions/` for UI work.
2. Load the `figma:figma-design-to-code` skill before using Figma MCP.
3. Read the latest Figma Make file with the registered official remote MCP
   server `figma`: `get_design_context` for key `kWBOdcae5utBZ6VtBHHXui`, node
   `0:1`, framework `react`, language `typescript`.
4. Confirm the actual callable tool name in the active session before invoking
   it. If it reports `Unknown tool`, inspect Codex MCP registration and the
   active session's tool list; do not retry guessed names. If sources cannot be
   read, stop the sync and record the error.
5. Read all returned source resources and assets. Check the Make source
   `src/App.tsx`, the component files, CSS tokens, types, demo behavior, and
   current app before editing. Make files may require the MCP resource templates
   exposed by the `figma` server. Do not copy `.figma/make` or other Make-only
   runtime files.
6. Treat Figma as the authority for visual decisions. Reuse exact layout,
   typography, colors, spacing, radii, assets, interaction states, and themes.
   Do not reconstruct the interface from a feature list or screenshot.
7. Keep components presentational; put workflow state in `features`/`hooks`,
   API calls in `services`, demo data and replies in `mocks`, and shared payloads
   in `packages/contracts`. Keep API and Agent behavior behind adapters. The
   author remains the only owner of chapter prose and canon decisions.
8. Compare the running page with the Figma Make preview at a desktop viewport,
   including light/dark themes and relevant collapsed/focused panels. The
   Figma `get_screenshot` endpoint may report Make as unsupported; if so, use a
   visible Make preview for qualitative comparison and record that an automated
   pixel diff was unavailable. Do not call that a pixel-perfect verification.
9. Run typecheck, lint, tests, and production build. Update `figma.md` and append
   the date, changed screens/components, verification, and unresolved issues to
   `sync-log.md`.
