# Coffer — dogfood #2 (epic-scale)

Self-hosted, Baldur's-Gate-themed bank-history analytics: import PDF/CSV/OFX
statements, classify each transaction into many groups, visualize income vs
outcome, multilingual, hexagonal, Docker-deployable.

This is the **second graph-workflow dogfood**, run to exercise the **epic
layer** (issue #19) on a real, feature-rich build. Opus planned and drove with
minimal oversight; Sonnet agents implemented under phase-parallel discipline.

## Status

| Slice | Change | State |
|---|---|---|
| 1 | `coffer-core-import` | **archived, green, reviewed** — import pipeline end-to-end |
| 2 | `coffer-classification` | pending (plan stub written) |
| 3 | `coffer-analytics` | pending (plan stub written) |
| 4 | `coffer-ui-i18n` | pending (plan stub written) |
| 5 | `coffer-packaging` | pending (plan stub written) |

Per the epic's dogfood scope: slice 1 is fully implemented, tested, reviewed,
and archived; slices 2–5 are planned and left honestly `pending` in the registry
(`roadmap.md`). Foundation: `prd.md`, `tech-stack.md` (14 decisions), `roadmap.md`
(epic registry + parent_refs ledger).

## Slice 1 result

Hexagonal import subsystem: pure-TS domain (bigint `Money`, stable content-hash
dedup), layered config, `StorePort` (better-sqlite3 + migrations, in-memory fake
sharing one contract), `PdfTextPort` (unpdf) separated from `StatementParserPort`
(generic-tabular-PDF via a bank-profile registry, CSV, OFX), import pipeline +
server composition root. **125 tests green; the idempotency e2e re-imports 5 real
fixtures through real sqlite and asserts zero new rows.** Memory operations are
queued in each change's `memory-backlog.md` (degraded mode — MCP unavailable).
