# context/

Graph-workflow lifecycle files. Files = lifecycle artifacts, graph = knowledge.

- `changes/` — active changes: `<change-id>/{change.md, plan.md, research.md}`
- `archive/` — immutable, append-only
- `foundation/` — PRD, tech-stack: human source of truth, distilled into the
  memory graph via /gw-foundation

NOTE (dogfood): the agentic-memory MCP server was unavailable during this build,
so the workflow ran in its degraded (files-only) mode. Would-be captures are
recorded in each change's `memory-backlog.md` for later replay.
