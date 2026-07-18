# copilot-mvp

status: implemented
created: 2026-07-18

## Goal
Ship a testable MVP of the interview copilot: hexagonal TS core (transcription →
turn detection → RAG retrieval → grounded answer) with swappable local/online
adapters, a 100-question markdown KB, Tauri+Svelte shell with a design system,
layered config, SQLite logging, and vitest coverage of the core.

memory_goal: UNAVAILABLE — agentic-memory MCP not registered in this session;
running in documented degraded mode (files only). Would-be memory operations are
recorded in memory-backlog.md for replay once the server exists.
