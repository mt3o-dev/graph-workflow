# Plan — coffer-core-import

Slice 1 of the `coffer-mvp` epic. Delivers the hexagonal core-import subsystem:
parse PDF/CSV/OFX statement text → normalize to `Transaction` → content-hash
dedup → persist to SQLite with import-batch tracking, wired through one
composition root. **No UI, no classification, no analytics, no packaging.**

All paths below are relative to `dogfood/coffer/`. Every phase's verification runs
on the build machine (Node 26 + pnpm) with **no Rust, no Docker, no network, no
GPU**. Green == the phase's `pnpm` command exits 0. Decisions cited as `[dec:N]`
refer to `context/foundation/tech-stack.md`; the memory graph is degraded, so
those foundation decisions ARE the recalled constraint set (see memory-backlog.md).

## Non-goals (this slice)

- No classification / rule engine / groups / review queue → **slice 2**.
- No analytics, attribution modes, or chart series → **slice 3**.
- No UI, design system, i18n, routes, or SvelteKit pages → **slice 4** (the
  SvelteKit scaffold is created here only to host the lib + tests; no screens).
- No Dockerfile, docker-compose, adapter-node production build, or Playwright
  e2e → **slice 5**.
- **No real bank PDFs.** PDF/parser correctness is proven with committed FIXTURE
  TEXT (pre-extracted statement text) + tiny hand-written CSV/OFX fixtures. The
  unpdf real-binary path is exercised only if a fixture `.pdf` happens to be
  present, and is skipped otherwise — never required for green.
- No AssistPort / LLM anything (slice 2+); no currency conversion; no OCR.

---

## Phase 1 — Scaffold + hexagonal skeleton + boundary-lint

Stand up the SvelteKit + adapter-node project, the vitest harness, the empty
hexagonal directory tree, and the purity guard **first** so every later phase is
born inside the boundary.

Implements: **[dec:1]** (SvelteKit 2 / Svelte 5 / TS strict, adapter-node),
**[dec:2]** (hexagonal layout + composition root + boundary-lint).

Files touched:
- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.json`,
  `vite.config.ts`, `svelte.config.js` (adapter-node), `.gitignore`
- `src/app.d.ts`, `src/app.html` (SvelteKit minimum; no routes/screens)
- `src/lib/core/.gitkeep`, `src/lib/ports/.gitkeep`,
  `src/lib/adapters/.gitkeep`, `src/lib/server/.gitkeep`
- `src/test/boundary-lint.test.ts` — asserts: files under `src/lib/core/**`
  import only from `src/lib/core/**` or `src/lib/ports/**` (no adapters, no
  framework, no node builtin, no bare package); `src/lib/ports/**` import only
  ports/core + type-only stdlib. Walks the tree and parses import specifiers.
- `src/test/setup.ts` if needed.

Verification: `pnpm install && pnpm typecheck && pnpm test` — boundary-lint test
passes over the (empty) tree; typecheck clean.

Risk: better-sqlite3 native build under pnpm 11 is blocked by default. Mitigation:
add `allowBuilds` / `onlyBuiltDependencies` for `better-sqlite3` (+ esbuild) in
`pnpm-workspace.yaml` now, before Phase 4 needs it (learned from the copilot
dogfood).

---

## Phase 2 — Domain types + normalization + content hash (pure core)

The heart of dedup. Build the `Transaction`/`Money` types, the shared
description-normalization module, and the content-hash function — all pure, all
unit-tested, before any adapter exists.

Implements: **[dec:5]** (content-hash dedup + locale/whitespace-stable
description normalization defined once in core and shared by every parser),
PRD FR2 (normalization schema).

Files touched:
- `src/lib/core/model/transaction.ts` — `Transaction`, `Money`
  (`{ minor: number-integer, currency: ISO4217 }`), `Direction = 'in'|'out'`
  (derived from amount sign), `ParsedRow` (parser output, pre-normalization).
- `src/lib/core/normalize/description.ts` — `normalizeForHash(raw)`: collapse
  internal whitespace, trim, uppercase-fold, strip diacritics **for the hash
  only**. Display description is kept raw/unmodified.
- `src/lib/core/normalize/transaction.ts` — `ParsedRow → Transaction`
  (currency/amount to integer minor units, direction derivation, batch id
  stamping).
- `src/lib/core/hash/content-hash.ts` — stable digest of
  `(account, bookingDate, amountMinor+currency, normalizeForHash(description))`
  using `node:crypto`? **No** — core must stay builtin-free ([dec:2]); use a
  tiny vendored pure-TS hash (e.g. FNV-1a/sha-256 in TS) under
  `src/lib/core/hash/`. Document the choice.
- Tests: `src/lib/core/normalize/description.test.ts`,
  `content-hash.test.ts` — same logical tx with different whitespace/case/
  diacritics/locale hashes identically; genuinely different txs differ.

Verification: `pnpm test src/lib/core` — normalization + hash-stability tests
green.

Risk: using `node:crypto` would violate core purity. Mitigation: pure-TS hash in
core; if a faster native hash is wanted later it belongs behind a port, not in
core. Recorded as a plan-boundary decision.

---

## Phase 3 — ConfigPort + layered config adapter

Implements: **[dec:11]** (defaults < env-file < `COFFER_` env vars, deep-merged
behind `ConfigPort`).

Files touched:
- `src/lib/ports/config-port.ts` — `ConfigPort.get<T>(path)` / typed accessors.
- `src/lib/adapters/config/layered-config.ts` — deep-merge of
  `config/default.json` < `config/<env>.json` < `COFFER_`-prefixed env
  (`__` = nesting). Exports `deepMerge`/`envToObject` helpers for reuse.
- `config/default.json`, `config/development.json`, `config/test.json` — at
  minimum `{ db: { path }, import: { enabledParsers: [...] } }`.
- Tests: `src/lib/adapters/config/layered-config.test.ts` — precedence
  (env var beats env file beats default), nesting via `__`, missing-layer
  tolerance.

Verification: `pnpm test src/lib/adapters/config` — precedence tests green.

Risk: env-var pollution across tests. Mitigation: tests set/restore a scoped env
object passed into the adapter, not `process.env` mutation.

---

## Phase 4 — StorePort + SQLite adapter + migration runner + import-batch schema

Implements: **[dec:3]** (SQLite via better-sqlite3 behind StorePort, migration
runner owns the schema), PRD FR1/FR2 (import-batch tracking).

Files touched:
- `src/lib/ports/store-port.ts` — `StorePort`:
  `insertTransactions(txs)`, `hasHashes(hashes) → Set`,
  `createImportBatch(meta) → id`, `getTransactions(filter?)`.
- `src/lib/adapters/store/sqlite-store.ts` — better-sqlite3 implementation,
  transactional inserts, hash lookup.
- `src/lib/adapters/store/migration-runner.ts` — applies
  `migrations/NNN_*.sql` in order, tracked in `schema_migrations`.
- `src/lib/adapters/store/migrations/001_init.sql` — `transactions`
  (content_hash UNIQUE, batch_id FK, amount_minor, currency, dates, direction,
  description, counterparty, account), `import_batches`
  (id, source, format, parsed/inserted/duplicate counts, created_at),
  `schema_migrations`.
- `src/lib/adapters/store/in-memory-store.ts` — a StorePort fake implementing
  the same contract (fallback + fast pipeline tests).
- Tests: `store.contract.ts` (shared contract suite) run by both
  `sqlite-store.test.ts` (real driver, `:memory:` / temp file) and
  `in-memory-store.test.ts`; `migration-runner.test.ts`.

Verification: `pnpm test src/lib/adapters/store` — migration runner applies
cleanly, both StorePort implementations pass the shared contract, UNIQUE hash
constraint rejects a duplicate.

Risk: better-sqlite3 fails to build on this machine. Mitigation: the in-memory
StorePort fake satisfies the same contract, so Phase 7's pipeline test stays green
regardless; if the native build fails, record it as a plan-boundary decision and
skip the sqlite-store test (`describe.skipIf`), do not block the slice.

---

## Phase 5 — PdfTextPort (unpdf) + StatementParserPort + generic-tabular PDF parser

Implements: **[dec:4]** (unpdf behind PdfTextPort feeding StatementParserPort;
generic-tabular + BankProfile registry).

Files touched:
- `src/lib/ports/pdf-text-port.ts` — `PdfTextPort.extract(bytes) →
  { pages: { text, items: {str,x,y}[] }[] }`.
- `src/lib/ports/statement-parser-port.ts` — `StatementParserPort.parse(input) →
  ParsedRow[]`; `input` is text (+ optional layout) or raw bytes for text-format
  parsers.
- `src/lib/adapters/pdf/unpdf-text.ts` — unpdf adapter (text + item positions).
- `src/lib/adapters/parsers/generic-tabular-pdf.ts` — header-signature
  detection + column-role mapping.
- `src/lib/adapters/parsers/bank-profile.ts` — `BankProfile` registry mapping a
  detected header signature → column roles.
- Fixtures: `src/test/fixtures/statements/generic-tabular.txt` (committed
  pre-extracted statement text), `.../generic-tabular.expected.json`.
- Tests: `parser.contract.ts` (shared: parser output shape + required fields);
  `generic-tabular-pdf.test.ts` runs it against the fixture text;
  `unpdf-text.test.ts` — asserts the adapter wiring, but the real-binary extract
  is `it.skipIf(no fixture .pdf present)` so it never requires a real PDF.

Verification: `pnpm test src/lib/adapters/parsers src/lib/adapters/pdf` —
generic-tabular parser reproduces the expected rows from fixture text; pdf
adapter test green (real-extract path skipped).

Risk: real PDF layout variance is unbounded. Mitigation (in scope): prove the
parser on fixture text only; the BankProfile registry is the extension seam for
real layouts later. Explicitly a non-goal to handle any specific real bank here.

---

## Phase 6 — CSV + OFX parser adapters

Implements: **[dec:4]** (CSV and OFX are sibling `StatementParserPort` adapters).

Files touched:
- `src/lib/adapters/parsers/csv-parser.ts` — dependency-light CSV → ParsedRow
  (column mapping via config/profile, delimiter/quote handling).
- `src/lib/adapters/parsers/ofx-parser.ts` — OFX/SGML `STMTTRN` → ParsedRow.
- Fixtures: `src/test/fixtures/statements/sample.csv`,
  `sample.csv.expected.json`, `sample.ofx`, `sample.ofx.expected.json` (tiny,
  hand-written, a handful of rows each incl. one intentional duplicate for
  Phase 7).
- Tests: `csv-parser.test.ts`, `ofx-parser.test.ts` run the shared
  `parser.contract.ts` against their fixtures.

Verification: `pnpm test src/lib/adapters/parsers` — CSV + OFX parsers reproduce
expected rows and satisfy the shared parser contract.

Risk: OFX has SGML and XML dialects. Mitigation: support the common SGML tag form
used by the fixture; document XML-OFX as a follow-up, don't pull an XML lib.

---

## Phase 7 — Import pipeline orchestrator + composition root + idempotency proof

The vertical seam: wire everything and prove idempotent import end-to-end.

Implements: **[dec:2]** (composition root), **[dec:3]/[dec:5]** (persist +
dedup), PRD FR1 (idempotent import) + FR2 (import-batch tracking).

Files touched:
- `src/lib/core/import/pipeline.ts` — pure orchestrator:
  `parse → normalize → hash → dedup(within-batch + StorePort.hasHashes) →
  persist(insertTransactions) → return batch summary(parsed/inserted/duplicate)`.
  Depends only on ports (`StatementParserPort`, `StorePort`, `ConfigPort`).
- `src/lib/core/import/format-detect.ts` — pick the parser for a source
  (extension/content sniff → enabledParsers from config).
- `src/lib/server/container.ts` — the single typed composition root
  (server-only): reads ConfigPort, constructs sqlite (or in-memory) StorePort,
  unpdf PdfTextPort, the parser set, and the pipeline. Constructor injection, no
  DI framework.
- Tests: `src/lib/core/import/pipeline.test.ts` (against port fakes);
  `src/test/import-e2e.test.ts` — builds the real container over a temp SQLite
  file, imports the CSV/OFX fixture, asserts N transactions + 1 import_batch,
  then imports the SAME fixture again and asserts **0 inserted, N duplicate**
  (idempotency), and that a fixture with an in-file duplicate row dedups
  within the batch too.

Verification: `pnpm typecheck && pnpm test` — full suite green including
boundary-lint (re-run over the now-populated tree) and the idempotency e2e.

Risk: composition root accidentally importing an adapter into core. Mitigation:
boundary-lint (Phase 1) fails the build if core reaches past ports; the container
lives in `src/lib/server`, outside core, by design.

---

## Verification summary (whole slice)

`pnpm typecheck && pnpm test` is the single green gate. It must pass with pnpm
alone. No phase depends on unpdf-on-real-PDF, better-sqlite3-must-build, Docker,
network, or a browser. Deferred/optional paths (`skipIf`) are documented at their
phase.

## Risks + mitigations (slice-level)

1. **Native better-sqlite3 build** may fail on this machine → in-memory StorePort
   fake carries the contract + pipeline tests; sqlite test `skipIf`. (Phase 4)
2. **Core purity erosion** — easiest slip is a `node:crypto`/driver import in
   core → boundary-lint landed in Phase 1, hash is pure-TS. (Phases 1,2,7)
3. **Fixture-only PDF proof** could mask real-parse fragility → explicit non-goal;
   BankProfile registry is the documented extension seam; unpdf real path is
   wired + skip-guarded so it's ready but not required. (Phase 5)
4. **Hash instability across parsers** (the classic dedup bug) → normalization is
   defined ONCE in core and every parser feeds through it; hash-stability tests
   assert whitespace/case/diacritic/locale invariance. (Phase 2)
5. **Amount float drift** → integer minor units end to end; `Money` never holds a
   float. (Phase 2)
