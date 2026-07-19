# Roadmap — Coffer (epic registry)

Per the graph-workflow epic layer: this file registers epic-sized goals and
slices them into ordered, independently-verifiable change-ids. Each slice is one
`/gw-new` change carrying `epic: coffer-mvp`. Slices pass their surviving node
ids to the next as `parent_refs` (recorded here as they archive).

## Epic: coffer-mvp

**Outcome:** a self-hosted, BG-themed bank-history analytics app that imports
PDF/CSV/OFX statements, classifies each transaction into many groups, and
visualizes income vs outcome — multilingual, hexagonal, Docker-deployable.

**Why sliced:** feature-rich and multi-subsystem (import, classification,
analytics, i18n, UI, packaging). One change cannot be one plan and one review
sitting — the interview-copilot dogfood proved the failure mode. Opus owns
refining the slice boundaries below at plan time.

### Slices — FINAL CUT (locked 2026-07-18 by Opus planning lead)

Decision: the 5 proposed slices are **confirmed as-is** — order unchanged. Each is
a vertical, independently-verifiable slice and the dependency chain is strictly
linear (1→2→3→4→5): classification needs stored transactions; analytics needs
groups+rules; UI/i18n consumes the three core subsystems; packaging wraps the
running server. No slice was split or merged: slice 1 is the largest but stays
one change because it is a single cohesive subsystem (the import pipeline) with
one plan and one review sitting — its 7 phases are internal sequencing, not
separate changes. The BG design system (dec:12) lives in slice 4 (its first real
consumer), not smeared across earlier slices.

**Verification substrate for every slice:** Node 26 + pnpm only. Green ==
`pnpm typecheck` + `pnpm test` (vitest) pass on the build machine. No Rust, no
Docker daemon, no GPU, no network keys on any slice's critical path. Docker
(dec:14) and Playwright e2e (dec:13) are authored in slice 5 but their
`docker build` / browser-run verification is deferred and documented.

| # | slice change-id | end-to-end-verifiable outcome | decisions | status |
|---|---|---|---|---|
| 1 | `coffer-core-import` | Given fixture statement text (extracted-PDF text + tiny CSV/OFX), the import pipeline parses → normalizes → content-hash-dedups → persists `Transaction` rows in a real SQLite file with an `import_batch` row; re-importing the same fixture adds zero rows. Proven by vitest through the composition root; no UI. | 1,2,3,4,5,11 | **archived 2026-07-18** ✓ green, reviewed |
| 2 | `coffer-classification` | Given stored transactions + user-defined groups (nestable tree + cross-cutting tags), the ordered additive rule engine assigns each tx the union of matched groups (many-to-many), routes unmatched to a review queue, and turns a manual correction into a reusable rule. AssistPort present with a local-heuristic adapter; LLM adapter stubbed + off. Proven by vitest. | 2,6,7,11 | pending (plan-stubbed) |
| 3 | `coffer-analytics` | Given classified transactions, core analytics produces income/outcome-over-time and by-group series, each series tagged **overlap** vs **partition** mode with split/primary/even attribution; totals reconcile per mode (partition sums to grand total, overlap may exceed). Prepared chart-series shapes returned, no rendering. Proven by vitest. | 2,8,9 | pending (plan-stubbed) |
| 4 | `coffer-ui-i18n` | BG/Forgotten-Realms design system + four screens (dashboard, import, review, settings) consuming slices 1–3 via a server composition root, layerchart income/outcome + group charts, paraglide (or typed-catalog) i18n en+pl with Intl number/currency/date formatting, no hardcoded UI strings (lint-guarded). Proven by vitest + @testing-library/svelte. | 1,9,10,12,13 | pending (plan-stubbed) |
| 5 | `coffer-packaging` | adapter-node server build, `Dockerfile` (multi-stage) + `docker-compose.yml` with a named SQLite volume + `COFFER_` env block, Playwright e2e scaffold, `docs/deferred-verification.md`, `docs/architecture.md` with mermaid. `pnpm build` green here; `docker build` + e2e deferred/documented. | 1,13,14 | pending (plan-stubbed) |

**parent_refs ledger** (filled as slices archive):
- coffer-core-import (archived 2026-07-18) → surviving nodes for slice 2's
  parent_refs: Transaction/Money model, content-hash + normalize-for-hash
  constraint, StorePort contract + single-owner dedup decision, ConfigPort/
  AppConfig shape, and the coffer-core-import change-summary. (Node ids assigned
  on backlog replay; until then, named handles from
  context/archive/coffer-core-import/memory-backlog.md.)

### Degraded-mode note (memory server down this epic)

agentic-memory MCP is UNAVAILABLE. The foundation docs (prd.md, tech-stack.md,
this file) ARE the recalled constraint set: every numbered decision in
tech-stack.md is a settled constraint each plan must respect or explicitly
contest. Would-be graph operations (create_change, capture_artifact,
append_events) are queued in each change's `memory-backlog.md` for replay.

## Scope note

For the dogfood, the goal is to exercise the workflow at epic scale with real
code, not to ship all five slices to production polish. Opus decides how many
slices to drive to green given the session; at minimum slice 1 (core import)
must be fully implemented, tested green, reviewed, and archived, with the epic
registry updated. Remaining slices may be left `pending` with their plans
written — a partial epic is a valid, honest outcome the registry records.
