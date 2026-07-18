# copilot-mvp

status: archived
archived: 2026-07-18
created: 2026-07-18

## Goal
Ship a testable MVP of the interview copilot: hexagonal TS core (transcription →
turn detection → RAG retrieval → grounded answer) with swappable local/online
adapters, a 100-question markdown KB, Tauri+Svelte shell with a design system,
layered config, SQLite logging, and vitest coverage of the core.

memory_goal: UNAVAILABLE — agentic-memory MCP not registered in this session;
running in documented degraded mode (files only). Would-be memory operations are
recorded in memory-backlog.md for replay once the server exists.

## Archive note (degraded mode)
Memory deactivate+sweep DEFERRED: no store existed during this change (MCP
unavailable). On replay: create_change + captures from memory-backlog.md, then
run the review-gate promotions and `memory_lifecycle.py deactivate copilot-mvp
--sweep`.
