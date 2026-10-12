# Figma UI source

## Authority and source

- File: [Writer Agent UI/UX Design](https://www.figma.com/make/kWBOdcae5utBZ6VtBHHXui/Writer-Agent-UI-UX-Design)
- Type: Figma Make
- File key: `kWBOdcae5utBZ6VtBHHXui`
- Entry node: `0:1`
- Make UI showed Version 3 at the time of review; the MCP response does not expose a version field.
- Last read: 2026-10-12 (Asia/Shanghai), using the official remote Figma MCP.
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

The Make `get_screenshot` tool explicitly reports that it does not support Make
files. A browser preview of the Make file was available and used for qualitative
desktop comparison; automated/pixel-diff screenshot comparison is not available
through that MCP tool. Three returned PNG resource payloads were truncated and
could not be decoded. The source code does not reference those PNGs; the three
complete PNGs and favicon were retained under `apps/web/public`.

No Figma Make runtime configuration, `.figma/make` directory, or platform-only
plugin was copied into the production app. Figma sync is a manual MCP workflow;
there is no automatic watcher or bidirectional sync.
