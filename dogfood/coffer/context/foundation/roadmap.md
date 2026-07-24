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
| 2 | `coffer-classification` | Given stored transactions + user-defined groups (nestable tree + cross-cutting tags), the ordered additive rule engine assigns each tx the union of matched groups (many-to-many), routes unmatched to a review queue, and turns a manual correction into a reusable rule. AssistPort present with a local-heuristic adapter; LLM adapter stubbed + off. Proven by vitest. | 2,6,7,11 | **archived 2026-07-24** ✓ green, reviewed |
| 3 | `coffer-analytics` | Given classified transactions, core analytics produces income/outcome-over-time and by-group series, each series tagged **overlap** vs **partition** mode with split/primary/even attribution; totals reconcile per mode (partition sums to grand total, overlap may exceed). Prepared chart-series shapes returned, no rendering. Proven by vitest. | 2,8,9 | **archived 2026-07-24** ✓ green, reviewed+reworked |
| 4 | `coffer-ui-i18n` | BG/Forgotten-Realms design system + four screens (dashboard, import, review, settings) consuming slices 1–3 via a server composition root, layerchart income/outcome + group charts, paraglide (or typed-catalog) i18n en+pl with Intl number/currency/date formatting, no hardcoded UI strings (lint-guarded). PLUS (amendment 2026-07-24): single-passphrase auth gate (node 74be155e — config passphrase, signed cookie, all routes, i18n'd login) and FANTASY NAMING for chrome (BG register, e.g. the dashboard as a treasury hall; theme never at expense of data legibility per dec:12); the analytics __unclassified__ series renders distinctly (node 0b08fbef). Proven by vitest + @testing-library/svelte. | 1,9,10,12,13 | **archived 2026-07-24** ✓ green, reviewed |
| 5 | `coffer-packaging` | adapter-node server build, `Dockerfile` (multi-stage) + `docker-compose.yml` with a named SQLite volume + `COFFER_` env block, Playwright e2e scaffold, `docs/deferred-verification.md`, `docs/architecture.md` with mermaid. `pnpm build` green here; `docker build` + e2e deferred/documented. | 1,13,14 | pending (plan-stubbed) |

**parent_refs ledger** (filled as slices archive):
- coffer-ui-i18n (archived 2026-07-24) → surviving nodes for slice 5's
  parent_refs: change-summary `40d8d9a4`, deployment constraints `2efdd460`
  (ORIGIN + prod env), `36a1a5c8` (first-boot mkdir + ?raw migrations),
  `a39430df` (env case-normalization); auth nodes `74be155e`/`d8caed23`/
  `512a3d11` promoted-candidates.
- coffer-analytics (archived 2026-07-24) → surviving nodes for slice 4's
  parent_refs: change-summary `1640b1ee`, ChartSeries DTO `eed7cc3c`,
  unclassified-bucket reconciliation decision `0b08fbef`, remainder algorithm
  `8cb49c78`, date-bucketing pattern `ab042c10`, splits-deferred (disputed)
  `ac2535ce`/`bc0ab42f`; plus slice-2 survivors per this change's parent_refs.
- coffer-classification (archived 2026-07-24) → surviving nodes for slice 3's
  parent_refs: change-summary `e1e72328`, many-to-many analytics constraint
  `534f6ff8`, assignment-provenance + derived-review-queue decision `efd6891c`,
  provenance-asymmetry issue `1ea505ed` (left standing), plus slice-1 survivors
  already in this change's parent_refs.
- coffer-core-import (archived 2026-07-18) → surviving nodes for slice 2's
  parent_refs, replayed into `context/memory-graph.db` (see
  `context/replay-log.md` for the full replay record):
  - change-summary (concept, mid-term): `d0e830bf-b58d-4812-9ad5-bb6b9262dd74`
  - Transaction/Money domain model (Phase 2 decision): `235e0742-ca6a-4394-b4ed-a36ea1ab33c2`
  - content-hash + normalize-for-hash constraint (Phase 2): `303587fe-6097-4307-b6d4-d301593eb4e5`
  - StorePort contract + single-owner dedup decision (review finding): `1b48605f-59a0-4032-b122-8ce591976e1a`
  - ConfigPort/AppConfig shape (Phase 3 decision): `2f81ab92-4bd9-4e85-826c-9ea6fd279c0f`
  - also applicable: rm-blocked flag-once lesson `1298a51f-2c98-4868-b373-a8f9d7f82890`,
    plan/task-prompt filename-drift lesson `8a129961-3b1c-4f40-b58a-50fb11573d32`

### Memory status (updated 2026-07-22)

The degraded-mode phase is OVER: the store is live at
`context/memory-graph.db`, the slice-1 backlog and foundation distillation are
REPLAYED (see `context/replay-log.md`), and `.mcp.json` at the repo root
registers the `agentic-memory` server for future sessions. Slices 2+ run the
real memory loop: recall_context before deciding, capture at boundaries,
append_events batches. Foundation `memory_goal` lives in
`context/foundation/foundation.md`. Pending human action: promotion of the
foundation nodes (lifetime candidates) and slice-1 survivors in the GUI
(`uv run agentic-memory-gui`); until then both liveness roots stay active and
NO deactivate/sweep runs for coffer-core-import.

## Scope note

For the dogfood, the goal is to exercise the workflow at epic scale with real
code, not to ship all five slices to production polish. Opus decides how many
slices to drive to green given the session; at minimum slice 1 (core import)
must be fully implemented, tested green, reviewed, and archived, with the epic
registry updated. Remaining slices may be left `pending` with their plans
written — a partial epic is a valid, honest outcome the registry records.
