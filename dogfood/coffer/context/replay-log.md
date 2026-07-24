# Memory REPLAY log — coffer dogfood

Replayed `context/foundation/{prd.md,tech-stack.md,roadmap.md}` and
`context/archive/coffer-core-import/memory-backlog.md` (immutable, not
modified) against the agentic-memory-system `AgentSurface`, into
`context/memory-graph.db`. Script:
`/mnt/vol1/mt3o/Documents/graph-workflow/.gw-scratch/replay_coffer.py`
(idempotent — state cached in `.gw-scratch/coffer_replay_state.json`).

## Counts

**Foundation change** (`goal: 2a712c73-6319-44f2-bb33-a63b2e3bccab`, change:
`3da9fd04-32b4-46ca-bfc7-9cb930a8eb2e`) — 26 nodes:
- 14 `decision` (tech-stack dec:1–14)
- 7 `constraint` (5 PRD non-negotiables + slice-boundary + no separate — see
  foundation.md table)
- 4 `issue` (PRD accepted gaps)
- 1 `concept` (epic-coffer-mvp structure)

**Slice 1 change** (`coffer-core-import`, goal:
`6815cf34-7657-46ef-894b-b08fe3bc3bbb`, change:
`57aa9836-0ef8-49e6-b5bb-c52d99565be7`) — 41 nodes:
- plan boundary: 8 (7 decisions/constraints implementing dec:2/4/5/3/11 +
  the fixture-only phasing decision)
- non-goals: 1
- phase 1: 4 (pins, vite-config gotcha, pnpm-workspace native-build risk,
  placeholder route)
- phase 2: 6 (file layout, Money.bigint, formatMoney scope,
  content-hash FNV-1a, diacritic-stripping limitation, hash/batch
  independence)
- phase 3: 4 (ConfigPort contract, test isolation, env-nesting
  case-sensitivity, committed config files)
- phase 4: 6 (sqlite adapter, migration runner, save/dedup, shared
  contract suite, pnpm-workspace fix, native-build-succeeded)
- phase 6: 2 (CSV/OFX hand-rolled parsers, zero-decimal-currency gap)
- phase 5: 3 (unpdf adapter, BankProfile seam, no-real-PDF-fixture)
- phase 7: 3 (single-owner dedup pipeline, composition root, idempotency
  e2e)
- review: 3 (rm-blocked-flag-once lesson, single-owner-idempotency lesson,
  plan-filename-drift lesson)
- change-summary: 1 (tier: mid-term)

**Events**: 5 `append_events` batches replayed — journal (plan boundary, 7
events: 1 NOTED degraded-mode + 6 USED tech-stack decisions), plan review (8
events: 6 REVIEWED/USED tech-stack decisions + USED non-goals + NOTED
approve verdict), phase 4 (4 events), phase 2 (4 events), phase 7 (5 events).
28 events total, all attached to real node ids from the replayed graph.

## Skipped (narration, not captured as durable nodes)

- Phase 1 `_probe.ts` rm-blocked narration (captured 5x verbatim across
  phases 1–7 in the backlog) — superseded by the single generalizable
  "review:rm-blocked-flag-once-lesson" node; recapturing the same fact five
  times would violate the gw-foundation "one statement per artifact"
  discipline for no retrieval benefit.
- Phase 4/7 "native build was available, not the skipIf path" repeated notes
  — condensed into the one `phase4:native-build-succeeded` node; the phase-7
  backlog entry restating the same fact was not recaptured as a separate
  node.

Everything else in the backlog was either captured as a distinct node or
folded into an `append_events` entry (verification-command narration, e.g.
"pnpm typecheck: 355 files, 0 errors" is recorded as an event `reason`
rather than a standalone node).

## recall_context("import statement parsing dedup", goal=slice-1) — verbatim

```
[node:6815cf34-7657-46ef-894b-b08fe3bc3bbb] type=goal tier=short-term
Hexagonal core-import slice: parse PDF/CSV/OFX -> normalize -> hash-dedup -> persist to SQLite behind ports, verifiable via pnpm

[node:c282e44d-4e69-49ff-aafd-b8f233a012e7] type=decision tier=short-term
Idempotent import via content-hash dedup. Each normalized transaction gets a stable hash of (account, booking date, amount, normalized description); re-import compares hashes within and across batches. Constraint: hashing must be locale/whitespace-stable, so description normalization (collapse spaces, strip diacritics for the hash only, not for display) is defined once in core and shared by every parser.

[node:fd58f2e6-cccc-4af5-8a98-095acb6e0b43] type=decision tier=short-term
PDF import: unpdf (serverless-friendly pdfjs build) behind PdfTextPort, feeding a StatementParserPort. ...

[node:c61c4107-45b4-418a-aad3-48ee1d0c20ee] type=decision tier=short-term
Persistence: SQLite via better-sqlite3 behind a StorePort. ...

[node:c9b15b68-7ec3-414f-8782-9afd2436f208] type=decision tier=short-term
Config layers: config/default.json < config/<env>.json < env vars (COFFER_ prefix, __ nesting), deep-merged behind ConfigPort. ...

[node:702ef151-2cc0-4464-8a36-f7c990329abe] type=decision tier=short-term
Hexagonal architecture, explicit composition root. ...

[node:59b27f44-9478-446b-8d24-9918eac771f9] type=decision tier=short-term
SvelteKit 2 + Svelte 5 (runes) + TypeScript strict, self-hosted via Node adapter. ...

[node:40bf8787-0583-4b35-9777-e479db89441d] type=decision tier=short-term
runImportPipeline({parser, payload, ctx, store, batchId}) is deliberately narrow ... ZERO dedup logic of its own — StorePort.save() owns ALL dedup ...

[node:d0e830bf-b58d-4812-9ad5-bb6b9262dd74] type=concept tier=mid-term
coffer-core-import (slice 1 of coffer-mvp) delivered a hexagonal import pipeline: PDF(unpdf text-extraction)/CSV/OFX -> StatementParserPort adapters -> pure-core normalize+content-hash -> StorePort ... (change-summary, full text in the graph)

[node:1b48605f-59a0-4032-b122-8ce591976e1a] type=constraint tier=short-term
Generalizable constraint across future slices/epics: StorePort ... should own idempotency ENTIRELY ...

[node:0fba9c02-819b-4b5e-994b-5826edadd0ee] type=decision tier=short-term
The idempotency e2e (import-idempotency.test.ts) ran 5 committed fixtures ...

[node:4ba189e0-fea2-45af-8b07-668035df6f28] type=decision tier=short-term
src/lib/server/container.ts (Container class + createContainer factory) is the composition root ...

... (30 nodes total returned, ranked; remainder are Phase 5/6/2/1/review
nodes and all 14 tech-stack decisions plus a handful of PRD-gap issues that
share facets — see .gw-scratch/coffer_replay_full_map.json for the complete
verbatim string)
```

**Assessment**: served exactly the right things — content-hash dedup
decision, PDF/StatementParser separation, StorePort/SQLite, ConfigPort, the
composition root, the single-owner-dedup pipeline decision, the
idempotency e2e, and the change-summary all rank near the top. Goal-dominant
recall correctly favored slice-1-scoped nodes over the full foundation set,
while still surfacing the tech-stack decisions the slice depends on.

## recall_context("what constraints apply to classification analytics", goal=foundation) — verbatim

```
[node:2a712c73-6319-44f2-bb33-a63b2e3bccab] type=goal tier=short-term
Establish coffer's foundational constraints, concepts, and decisions as always-live shared knowledge

[node:bc0ab42f-9e20-4780-85df-748975ff1d1c] type=decision tier=short-term
Analytics in core, two attribution modes. ... overlap ... or partition ... UI always labels which mode a chart uses.

[node:5da27e33-8f49-42bc-85f2-601d40a377c9] type=decision tier=short-term
Classification: an ordered rule engine in core, many-to-many. ... Constraint: analytics must never assume one-group-per-tx.

[node:69a219f9-3563-412a-bd1d-eb9a4f05f84b] type=issue tier=short-term
Accepted gap (v1): currency conversion is display-only using user-supplied rates; no live FX.

[node:77b1911b-9aa8-4ca5-b9b6-3a79ccf7325d] type=constraint tier=short-term
Because a transaction can match multiple groups, analytics distinguishes overlapping ... from partitioned views ... and labels which is shown.

[node:534f6ff8-af1b-4100-a487-cf6ed2e0a02f] type=constraint tier=short-term
A transaction belongs to zero or more groups (many-to-many), not a single category; analytics must never assume one-group-per-tx.

[node:9adeeb7b-32a8-41f5-8482-ff1021ea29bc] type=decision tier=short-term
Charts: a small dependency-light chart layer. ...

[node:b94a5c28-6b4f-4ef2-9bc2-c0ac79020136] type=decision tier=short-term
Optional categorization assist behind AssistPort. ...

... (full 26-node foundation set returned, ranked; complete verbatim string
in .gw-scratch/coffer_replay_full_map.json)
```

**Assessment**: served exactly the right things — the two overlap/partition
attribution constraint+decision pair and the multi-group classification
constraint+decision pair rank in the top 6, ahead of unrelated foundation
nodes (SvelteKit stack pins, Docker packaging). Because the foundation goal
has no slice-specific dominance, the whole 26-node foundation set came back
ranked rather than filtered — expected and correct for a foundation-scope
recall (this is the "always-live shared knowledge" root, not a slice).

## review_queue()

```
(no nodes are flagged for review)
```

No CONTRADICTS edges were recorded during this replay (the backlog had none
to replay), so nothing is flagged. Expected state after a first-time replay.

## Slice-2 parent_refs node ids (from roadmap.md's ledger)

Per `memory-backlog.md`'s "parent_refs for slice 2" section — the surviving
nodes that should seed `coffer-classification`'s pre-create discovery recall:

| handle | node_id |
|---|---|
| change-summary (concept) | d0e830bf-b58d-4812-9ad5-bb6b9262dd74 |
| Transaction/Money domain model (Phase 2) | 235e0742-ca6a-4394-b4ed-a36ea1ab33c2 |
| content-hash / normalize-for-hash constraint (Phase 2) | 303587fe-6097-4307-b6d4-d301593eb4e5 |
| StorePort contract + single-owner dedup decision (review finding) | 1b48605f-59a0-4032-b122-8ce591976e1a |
| ConfigPort / AppConfig shape (Phase 3) | 2f81ab92-4bd9-4e85-826c-9ea6fd279c0f |

(The backlog also named three generalizable review lessons as applicable to
slice 2's own cycle: `1298a51f-2c98-4868-b373-a8f9d7f82890` (rm-blocked
flag-once), `1b48605f-59a0-4032-b122-8ce591976e1a` (single-owner
idempotency, already listed above), and `8a129961-3b1c-4f40-b58a-50fb11573d32`
(plan/task-prompt filename drift) — worth including in slice 2's
`create_change` parent_refs alongside the five above.)

## API surprises

- None that blocked the replay. `capture_artifact`'s `edges` parameter
  requires `direction: "out"|"in"` explicitly per spec entry (defaults to
  "out" if omitted per the source, but every edge was passed explicitly
  here) — matched the docstring exactly, no trial-and-error needed.
- `create_change` on a duplicate `change_id` raises `AgentSurfaceError`
  rather than silently returning the existing ids; the script recovers by
  querying `nodes`/`edges` directly for the `/change/<id>` path and its
  `SCOPED_TO` goal — this worked cleanly on a rerun during development.
- No facet-vocabulary collisions were flagged (`facet_warnings` empty on
  every capture) — the facet set chosen (architecture, import, persistence,
  config, i18n, ui, analytics, classification, testing, deployment, plus
  coffer-mvp, tooling, dedup, process, planning, cleanup, native-deps,
  fixtures, pdf) stayed distinct enough for the embedding-based
  near-synonym gate not to trigger.
