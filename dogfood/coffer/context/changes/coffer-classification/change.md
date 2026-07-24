# coffer-classification

status: open
created: 2026-07-22
epic: coffer-mvp

## Goal
Classify stored transactions into many groups: nestable group tree + tags,
ordered additive many-to-many rule engine, review queue for unmatched,
correction-to-rule, AssistPort with local heuristic (LLM stub off).

memory_goal: 78e746db-7b14-4d0b-bc7d-6cbd4021b981

## Memory
First change on the LIVE store (context/memory-graph.db) — no backlog file;
capture/recall/journal run for real via the agentic-memory surface
(.venv python at /mnt/vol1/mt3o/Documents/agentic-memory-system, or the MCP
server in fresh sessions). parent_refs: slice-1 survivors per roadmap.md ledger.
Seed recall served: rule-engine decision [node:5da27e33], slice-1 change-summary
[node:d0e830bf], store-owns-dedup constraint [node:1b48605f], config decision
[node:c9b15b68].
