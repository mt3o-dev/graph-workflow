# coffer-core-import

status: open
created: 2026-07-18
epic: coffer-mvp

## Goal
Build the hexagonal core-import slice of Coffer: a framework-free domain core and
adapters that parse PDF/CSV/OFX statement text into normalized `Transaction`
records, dedup them by a locale-stable content hash, and persist them (with
import-batch tracking) to SQLite behind ports — end-to-end verifiable through the
composition root with `pnpm typecheck` + `pnpm test`, no UI.

memory_goal: UNAVAILABLE — agentic-memory MCP not registered this session; running
in documented degraded mode (files only). Would-be memory operations are recorded
in memory-backlog.md for replay once the server exists. The foundation docs
(prd.md, tech-stack.md, roadmap.md) stand in as the recalled constraint set:
tech-stack decisions 1,2,3,4,5,11 are the settled constraints this slice
implements.
