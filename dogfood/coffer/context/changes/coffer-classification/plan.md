# Plan — coffer-classification (slice 2 of `coffer-mvp`)

Grounded in the LIVE memory graph (`context/memory-graph.db`). Paths relative to
`dogfood/coffer/`. Verification substrate: **Node 26 + pnpm only** — every phase is
green iff `pnpm typecheck && pnpm test` (vitest) pass. `better-sqlite3` native build
WORKS on this machine, but the classification store follows slice-1's discipline: an
in-memory fake is the native-build-independent contract path.

## Goal
Classify stored transactions into zero-or-more user-defined groups via an ordered
additive rule engine, route unmatched to a review queue, promote a manual correction
into a reusable rule, and offer non-committing suggestions via `AssistPort` — all in
the hexagonal core, verifiable via pnpm. Implements [dec:6], [dec:7], [dec:2],
[dec:11]; PRD FR3, FR5.

## Memory provenance
- Recalled and leaned on: rule engine `[node:5da27e33]`, many-to-many constraint
  `[node:534f6ff8]`, single-owner-dedup `[node:1b48605f]`, hexagonal/composition-root
  `[node:702ef151]`, AssistPort `[node:b94a5c28]`, normalize-for-hash `[node:303587fe]`,
  ConfigPort/AppConfig `[node:2f81ab92]`, Transaction model `[node:235e0742]`, SQLite/
  migration-runner `[node:c61c4107]`, slice-1 summary `[node:d0e830bf]`.
- **Decisions captured this plan** (new nodes, this is where the WHY lives):
  - `[node:91d27d36]` Group/Tag model (kind discriminator)
  - `[node:eb01608c]` Rule model (predicate-as-DATA, order, additive union, stopAfter)
  - `[node:a49130e3]` port split — new `ClassificationStorePort`, not a StorePort extension
  - `[node:efd6891c]` assignment provenance + sticky manual + derived review queue
  - `[node:65e4485f]` correction→rule promotion
  - `[node:9117c159]` AssistPort — heuristic default, LLM stub off, never-commits
- Slice-3 boundary (recall #2): `[node:bc0ab42f]`/`[node:77b1911b]` attribution modes
  and `[node:9adeeb7b]` charts are **NOT** this slice — see Non-goals.

## Load-bearing design decisions (settled here)

1. **Group/Tag** `[node:91d27d36]`. `Group = { id, name, parentId: string|null,
   kind: 'group'|'tag' }`. Nestable tree via `parentId`; a cross-cutting tag is a
   parentless `kind:'tag'` node. The explicit `kind` refines [dec:6]'s "both just Group
   nodes with an optional parent" so a tree *root* is distinguishable from a flat tag —
   an elaboration, not a contradiction.
2. **Rule** `[node:eb01608c]`. Predicate is **serializable DATA** (a discriminated
   union of field matchers `{ field, op, value }` composed with `all`/`any`), not a JS
   function — so rules persist and can be minted from corrections. `Rule = { id, name?,
   order, predicate, assign: groupId[], stopAfter?: boolean }`. Engine evaluates a tx
   against ALL rules in `order`, accumulates the **additive UNION** of every matching
   rule's `assign`; a matching rule with `stopAfter` halts further evaluation.
3. **Port split** `[node:a49130e3]`. New `ClassificationStorePort`, **not** a StorePort
   extension — honours single-owner-dedup `[node:1b48605f]` by leaving StorePort focused.
   Engine stays pure in `core`; persistence behind the new port; SQLite adapter + in-memory
   fake + one shared contract. The SQLite classification adapter opens the **same configured
   db file** so `assignments.tx_content_hash` FK-references `transactions.content_hash`.
4. **Assignments** `[node:efd6891c]`. Carry `source: 'rule'|'manual'|'assist'` (+ `ruleId?`).
   Keyed to a tx by `content_hash` (the domain `Transaction` has no surrogate id
   `[node:235e0742]`). Re-running the engine is additive/idempotent and **never deletes a
   manual correction** (manual assignments sticky). **Review queue = derived read** of txns
   with zero assignments — no separately persisted queue.
5. **Correction→rule** `[node:65e4485f]`. A manual assignment promotes to a Rule whose
   predicate is derived from the tx (default `counterparty` equals; else `description`
   equals) and whose `assign` is the corrected group set. Re-eval reproduces the correction.
6. **Assist** `[node:9117c159]`. `AssistPort.suggest(tx) -> Suggestion[] { groupId, score }`,
   ranked, never commits. Heuristic adapter scores by frequency/similarity over past
   classified txns, tokenizing via core normalize-for-hash `[node:303587fe]`. LLM (Haiku)
   adapter is a constructor-injected transport **stub**, off by default via existing assist
   config `[node:2f81ab92]`, faked in tests — no network on any pnpm path.

## Phases

### P1 — Group/Tag model + `ClassificationStorePort` + migration 002
- `src/lib/core/model/group.ts` — `Group` type + pure tree helpers (childrenOf, ancestry,
  cycle-guard on parentId).
- `src/lib/ports/classification-store.port.ts` — new port: group CRUD (`upsertGroup`,
  `getGroup`, `listGroups`, `deleteGroup`), placeholder rule + assignment methods filled in
  P2/P3. Import-clean (boundary-lint guards it).
- `src/lib/adapters/store/migrations/002_classification.sql` — `groups`, `rules`,
  `assignments` tables (assignments FK → `transactions(content_hash)`); applied by the
  existing migration runner (lexicographic, idempotent) `[node:c61c4107]`.
- `src/lib/adapters/store/sqlite-classification-store.adapter.ts` — SQLite adapter over the
  configured db file.
- `src/test/fakes/in-memory-classification-store.ts` + `src/test/contracts/classification-store.contract.ts`
  — shared contract run against fake (always) and SQLite (temp file).
- **Verify:** `pnpm typecheck && pnpm test` — group-tree + tag CRUD contract green on both
  adapters; cycle-guard + boundary-lint pass.

### P2 — Rule model + pure classification engine
- `src/lib/core/model/rule.ts` — `Rule` + `Predicate` discriminated union (fields:
  description, counterparty, amount [range/compare], account; combinators `all`/`any`).
- `src/lib/core/classify/predicate.ts` — pure `compile(predicate) -> (tx) => boolean`.
- `src/lib/core/classify/engine.ts` — `classify(txns, rules) -> Assignment[]`: ordered
  eval, additive union of `assign`, `stopAfter` short-circuit; pure, no I/O.
- Tests: predicate matchers per field; engine multi-group accumulation, ordering,
  `stopAfter` exclusivity, empty-match → no assignment.
- **Verify:** `pnpm typecheck && pnpm test`.

### P3 — Assignment persistence + review queue
- Extend `classification-store.port.ts`: `saveAssignments(source, rows)`,
  `assignmentsFor(contentHash)`, `unmatched()` (derived review queue), rule CRUD
  (`upsertRule`, `listRules` ordered by `order`).
- Adapter + fake + contract additions; persist engine output with `source:'rule'`.
- Invariant test: **manual assignment survives a rule re-eval** (sticky); `unmatched()`
  returns exactly the zero-assignment txns; re-running classify is idempotent (no dup rows).
- **Verify:** `pnpm typecheck && pnpm test`.

### P4 — Correction→rule flow
- `src/lib/core/classify/promote.ts` — pure `promoteToRule(tx, groupIds, opts) -> Rule`
  (predicate derived per decision 5).
- Persist a manual assignment (`source:'manual'`); promote → append rule → re-classify
  reproduces the correction for matching txns; original manual row stays sticky.
- Tests: correction-promotes-to-rule; re-run reproduces; manual not clobbered.
- **Verify:** `pnpm typecheck && pnpm test`.

### P5 — AssistPort + heuristic adapter + LLM stub
- `src/lib/ports/assist.port.ts` — `AssistPort.suggest(tx, ctx) -> Suggestion[]`.
- `src/lib/adapters/assist/heuristic-assist.adapter.ts` — frequency/similarity over past
  classified descriptions via normalize-for-hash tokenizer `[node:303587fe]`.
- `src/lib/adapters/assist/llm-assist.adapter.ts` — constructor-injected `AssistTransport`
  STUB, off by default; tests drive a mocked transport (no network).
- Tests: heuristic ranking; **assist-never-commits** invariant (suggest touches no store);
  LLM stub returns via mocked transport only, disabled by config.
- **Verify:** `pnpm typecheck && pnpm test`.

### P6 — Composition-root wiring + integration
- `src/lib/server/container.ts` — construct `SqliteClassificationStore` on the same db
  file, select `AssistPort` per `config.assist.{adapter,enabled}` `[node:2f81ab92]`, expose
  `classify()`, `assign()`, `reviewQueue()`, `promoteToRule()`, `suggest()`. `init()` already
  runs the migration runner → picks up 002 automatically.
- Integration test (real SQLite temp file, through the container): import fixtures →
  define groups/rules → classify → assert unmatched → manual-correct → promote → re-classify
  reproduces; manual sticky.
- Delete the inert `src/lib/core/_probe.ts` if still present (needs explicit confirmation —
  `rm` is permission-gated; otherwise leave inert).
- **Verify:** `pnpm typecheck && pnpm test && pnpm build`.

## Non-goals (scope fence)
- **No analytics / attribution modes** — overlap vs partition `[node:bc0ab42f]`/
  `[node:77b1911b]` is slice 3 (`coffer-analytics`). This slice only *preserves* the
  many-to-many invariant `[node:534f6ff8]` so slice 3 can build on it.
- **No charts** `[node:9adeeb7b]`, **no UI, no i18n** (slice 4).
- **LLM assist is a stub, off by default, no network** — `[dec:7]`; only the heuristic
  adapter runs real in verification.
- No split-transaction attribution, no primary-group designation (analytics concern).
- No StorePort contract change; no AppConfig shape change.

## Risks & mitigations
- **R1 native build** — classification store verified primarily via the in-memory fake +
  shared contract (slice-1 pattern `[node:d0e830bf]`); SQLite contract runs on a temp file.
- **R2 cross-table FK / `:memory:` / connection pragmas** — SQLite classification
  tests use a temp file (not `:memory:`, which would be a separate DB); the
  in-memory fake covers the `:memory:`-equivalent path; production shares one
  configured file. **[plan-review rework]** better-sqlite3 leaves FK enforcement
  OFF by default, so P1's adapter MUST run `PRAGMA foreign_keys = ON` and
  `PRAGMA busy_timeout = 5000` on EVERY new connection (both the classification
  adapter and — fixing the pre-existing slice-1 gap — `SqliteStoreAdapter`),
  else migration 002's declared FKs are decorative and near-simultaneous writes
  from two connections throw SQLITE_BUSY instead of waiting. P1's contract test
  asserts FK enforcement is actually on (inserting an assignment for a missing
  tx hash must throw).
- **R3 predicate expressiveness** — predicate-as-DATA `[node:eb01608c]` limits ad-hoc logic;
  mitigated by an extensible discriminated union + `all`/`any` combinators.
- **R4 re-eval clobbers corrections** — sticky-manual invariant test in P3/P4
  `[node:efd6891c]`.
- **R5 migration double-apply** — runner tracks `schema_migrations`, idempotent
  `[node:c61c4107]`.
- **R6 blast radius of the rule-shape refinement** — `trace_impact` on `[node:5da27e33]`
  returns only `[node:534f6ff8]` + the foundation goal (depth=1); on `[node:1b48605f]` only
  the two slice goals; on `[node:534f6ff8]` only the foundation goal. All shallow → the
  refinement is local and I elaborate rather than supersede (no CONTRADICTS). **Graph gap
  noted:** slice-3 analytics nodes reference the many-to-many constraint in prose but have
  no DEPENDS_ON edge to `[node:534f6ff8]`, so the trace understates the semantic dependency —
  slice-3 planning must re-read this constraint regardless.

## parent_refs (on open)
Surviving slice-1 nodes per roadmap ledger: `[node:d0e830bf]` (summary), `[node:235e0742]`
(Transaction/Money), `[node:303587fe]` (normalize-for-hash), `[node:1b48605f]` (StorePort/
single-owner dedup), `[node:2f81ab92]` (ConfigPort) + facet `coffer-mvp`.
