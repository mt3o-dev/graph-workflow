# Plan — coffer-analytics (slice 3 of coffer-mvp)

Paths relative to `dogfood/coffer/`. Verification is **pnpm-only**: every phase
ends green on `pnpm typecheck && pnpm test` (P4 also `pnpm build` + boundary-lint).
Decisions cited by `[node:id]` from `context/memory-graph.db`.

## Goal
Compute income/outcome-over-time and by-group series in the hexagonal core over
classified transactions, with explicit **overlap** vs **partition** attribution
modes, totals reconciling per mode, returned as prepared chart-series DTOs — no
rendering. Grounded in `[node:bc0ab42f]` (two modes), `[node:534f6ff8]` (never
assume one-group-per-tx), `[dec:2]/[dec:8]/[dec:9]` (tech-stack), PRD FR4.

## Design decisions this plan settles
- **Input shape / join site.** Analytics core stays PURE functions over
  in-memory arrays: `analyze(txns, assignments, groups, opts)` — no port imports
  in `core/analytics/**` ([dec:2], boundary-lint). The join happens in the
  container (`Container.analytics()`), which loads `store.all()` +
  `classificationStore.allAssignments()` + `listGroups()` and calls the pure core.
- **Bulk assignment read (port addition).** `ClassificationStorePort` gains
  `allAssignments(): Promise<Assignment[]>` (SQLite adapter + in-memory fake +
  shared contract). Rationale: analytics needs the full tx↔group join; the per-tx
  `assignmentsFor` N+1 loop used by `suggest()` is wrong at dataset scale. This
  respects `[dec:efd6891c]` (assignments keyed by `content_hash`, no surrogate id).
- **Provenance-agnostic analytics.** Attribution counts the `(tx, group)` pair,
  NOT its `source`. So the provenance-asymmetry issue `[node:1ea505ed]` (a manual
  intent silently stored as `source:'rule'`) does NOT affect analytics
  correctness — a group membership is a group membership. Recorded openly; analytics
  does not need to care about the asymmetry in v1.
- **AttributionMode.** `type AttributionMode = 'overlap' | 'partition'`. Every
  group-aggregated series carries its mode label ([dec:8], `[node:77b1911b]`).
  - **overlap**: each matched group counts the full tx amount; cross-group totals
    may exceed the grand total (expected, labeled).
  - **partition**: each tx amount is attributed ONCE. v1 resolution =
    **primary-else-even** (see splits decision).
- **Splits DEFERRED — narrowing of `[node:bc0ab42f]`.** Slices 1–2 persist NO
  split table and NO split-amount field (`engine.ts`/`assignment.ts` Assignment =
  `{txContentHash, groupId, source, ruleId?}`, no amount). So partition v1 cannot
  resolve "by split amounts". v1 partition = **designated-primary-group-else-even**,
  with the split-amount branch DEFERRED to a future slice (needs a split model +
  migration). Primary is NOT a new persisted field either: partition accepts an
  optional pure policy `primaryGroupOf(txContentHash, candidateGroups) => groupId?`
  in `opts` (default: none → even). This narrows bc0ab42f openly (edge captured);
  it does not silently drop the partition contract — even remains exact.
- **Even-split bigint remainder.** Splitting `amount.minor` (bigint) across N
  groups: each gets `minor / N`; remainder `minor % N` is distributed
  deterministically — +1 minor unit to the first `|remainder|` groups by sorted
  `groupId` (sign-aware for outflows). Guarantees the partition of a tx sums to
  its amount EXACTLY. TESTED as a property.
- **By-group rollup over the nestable tree.** A tx counts into an ancestor group
  if assigned to that ancestor OR any descendant, **counted once per subtree**
  (subtree-dedup) so a tx assigned to both a parent and its child is not
  double-counted within that subtree. Two labeled rollup shapes: `self` (direct
  assignments only) and `rollup` (subtree-deduped). Rollup composes with mode:
  partition-rollup still sums to grand total; overlap-rollup may exceed (labeled).
- **Currency.** Per-currency series, NO conversion ([dec:8] gap accepted by PRD):
  a mixed-currency dataset yields one series set per currency; reconciliation
  invariants hold per currency. Uses `Money` bigint minor units end-to-end.
- **Time bucketing.** `granularity: 'day' | 'week' | 'month'`; buckets keyed by
  the ISO date (`YYYY-MM-DD`) of the bucket START. Timezone-free: parse
  `bookingDate` by string / UTC arithmetic only — NO `new Date(localString)`.
  Week = ISO week (Monday start); month = first-of-month. Optional date-range +
  `sourceAccount` filters.
- **Prepared ChartSeries DTO (slice-4 boundary).** `core/analytics/model.ts`
  exports:
  `Point { bucket: string; value: bigint }`,
  `Series { id: string; label: string; mode: AttributionMode; currency: string; points: Point[] }`,
  `SeriesSet { series: Series[]; grandTotalMinor: bigint; currency: string }`.
  These are DATA, not components ([dec:9]) — no d3/layerchart import in core.
  (bigint→JSON serialization for the HTTP boundary is slice-4's concern, noted.)

## Phases

### P1 — Analytics domain types + bucketing primitives
Files: `src/lib/core/analytics/model.ts` (AttributionMode, Point, Series,
SeriesSet, Granularity), `src/lib/core/analytics/buckets.ts` (pure
day/week/month bucketing, UTC/string arithmetic).
Verify: `pnpm typecheck && pnpm test` — bucketing unit tests: month boundary,
ISO-week Monday start, leap-year Feb, year rollover, no local-tz drift.

### P2 — Income/outcome over time
Files: `src/lib/core/analytics/cashflow.ts` — direction split (`directionOf`),
per-currency series, date-range + account filters, net = income − outcome.
Verify: `pnpm typecheck && pnpm test` — cashflow tests incl. multi-currency
(separate series, no cross-currency add) and filter correctness.

### P3 — Attribution modes + by-group series
Files: `src/lib/core/analytics/attribution.ts` (overlap vs partition,
even-split bigint remainder, optional `primaryGroupOf` policy),
`src/lib/core/analytics/by-group.ts` (self vs subtree-deduped rollup over
`group.ts` tree helpers).
Verify: `pnpm typecheck && pnpm test` — **reconciliation property tests** on a
fixture with a multi-group tx: partition sums to grand total EXACTLY per currency;
overlap ≥ grand total; even-split remainder deterministic & total-preserving;
rollup subtree-dedup (no double count parent+child); **primary-branch property
test [plan-review rework]**: when `primaryGroupOf` resolves a group, that group
receives the full amount, all other matched groups receive zero, and the tx
still reconciles to grand total exactly — so the primary branch is exercised
code, not dead policy.

### P4 — Prepared series assembly + container/port wiring
Files: `src/lib/core/analytics/series.ts` (assemble `SeriesSet` DTOs);
`src/lib/ports/classification-store.port.ts` (+`allAssignments()`);
`src/lib/adapters/store/sqlite-classification-store.adapter.ts` +
in-memory fake (+ shared contract test); `src/lib/server/container.ts`
(`analytics()` join method).
Verify: `pnpm typecheck && pnpm test && pnpm build` — series-shape tests,
`allAssignments` contract test (both adapters), boundary-lint green (core imports
ports only; no d3/layerchart/component import under `core/**`).

## Non-goals
- No rendering / UI / components / i18n / layerchart / d3 (slice 4).
- No FX / currency conversion (PRD-accepted gap; per-currency series only).
- No split-amount attribution and no split table/migration (DEFERRED; narrows
  `[node:bc0ab42f]`).
- No new persisted primary-group field (primary is an optional pure policy input).
- No bigint→JSON serialization design (slice-4 HTTP-boundary concern).

## Risks + mitigations
- **bigint even-split remainder** (integer division loses the remainder → totals
  don't reconcile). Mitigate: deterministic remainder distribution + a property
  test asserting each tx's partition sums to its exact amount, per currency.
- **Double-count in by-group rollup** (many-to-many `[node:534f6ff8]` × nestable
  tree: a tx on both parent and child, or overlap mode). Mitigate: subtree-dedup
  in rollup; mode label on every series; overlap explicitly allowed to exceed.
- **N+1 assignment read** at dataset scale. Mitigate: `allAssignments()` bulk port
  read; analytics core takes the full array.
- **Timezone date drift** in bucketing. Mitigate: string/UTC arithmetic only, no
  local `Date` parsing; explicit calendar-edge tests.
- **Provenance-asymmetry `[node:1ea505ed]`** understating manual intent. Decided
  NON-blocking: analytics is provenance-agnostic (counts the pair, not the source).
