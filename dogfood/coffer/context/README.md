# context/

Graph-workflow lifecycle files. Files = lifecycle artifacts, graph = knowledge.

- `changes/` — active changes (epic slices): `<change-id>/{change.md, plan.md}`
- `archive/` — immutable, append-only
- `foundation/` — PRD, tech-stack, roadmap (epic registry): human source of truth

NOTE (dogfood): agentic-memory MCP unavailable — running in degraded mode.
Would-be memory operations queue in each change's `memory-backlog.md` for replay
(per the workflow's degraded-mode rule).
