# Plan (STUB) — coffer-analytics

Slice 3 of `coffer-mvp`. **Not yet opened as a change** (no change.md); `pending`
in roadmap.md. Thin stub for later /gw-plan expansion.

Paths relative to `dogfood/coffer/`. Verification: `pnpm typecheck` + `pnpm test`
only. Decisions from `context/foundation/tech-stack.md`.

## Goal
Compute income/outcome-over-time and by-group analytics in the hexagonal core,
with explicit **overlap** vs **partition** attribution modes (because a tx can
match many groups), returning prepared chart-series shapes — no rendering.

## Implements
[dec:8] analytics in core, two attribution modes (overlap: each matched group
counts full amount, totals may exceed grand total; partition: attributed once by
split amounts, else primary group, else evenly); [dec:9] chart *data shaping* in
core, components render prepared series; [dec:2] core purity. PRD FR4.

## Phases (bullet level)
- **P1 Aggregation primitives** — date-bucketing (day/week/month), income vs
  outcome split by direction, date-range + account filters. Verify: time-series
  aggregation unit tests.
- **P2 Attribution modes** — `AttributionMode = 'overlap' | 'partition'`; every
  group-aggregated metric declares its mode. Partition resolves via split amounts
  → designated primary group → even split. Verify: reconciliation tests
  (partition sums to grand total; overlap may exceed) — the anti-double-counting
  guarantee.
- **P3 By-group series** — spend-by-group, group trends over time, cashflow
  balance; each series carries its mode label. Verify: by-group series tests
  against fixture classified transactions.
- **P4 Prepared chart-series shapes** — stable DTOs (`Series`, `Point`, mode
  label) the slice-4 UI consumes; no d3/layerchart import in core. Verify:
  series-shape snapshot tests; boundary-lint still green.

## Verification approach
Fixture set of classified transactions (multi-group txs incl. a split) →
assert both modes reconcile as specified. Green == `pnpm typecheck && pnpm test`.
Core imports only ports; chart shaping is data, not components ([dec:9]).

## parent_refs (on open)
Surviving nodes of coffer-classification (Group model, rule engine, many-to-many
invariant) + coffer-core-import (Transaction, StorePort) + facet `coffer-mvp`.
