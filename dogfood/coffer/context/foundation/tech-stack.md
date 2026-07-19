# Tech stack & decision record — Coffer

Normative statements (the /gw-foundation distillation set). Each carries its why.
The build machine has Node 26 + pnpm, NO Rust/GPU, NO Docker daemon running, NO
network keys — so every slice's verification must pass with pnpm alone
(typecheck + vitest). Docker packaging is authored and verified elsewhere.

## Decisions

1. **SvelteKit 2 + Svelte 5 (runes) + TypeScript strict, self-hosted via Node
   adapter.** Self-hosted analytics is a web app, not a desktop app: `@sveltejs/
   adapter-node` produces a server that `docker compose` runs. Rationale over a
   Tauri build: the requirement is "self-hosted" (server + volume), and it keeps
   the whole stack in one language for the hexagonal core.
2. **Hexagonal architecture, explicit composition root.** `src/lib/core` (pure
   domain: import pipeline, classification engine, analytics) imports only
   `src/lib/ports`. Adapters in `src/lib/adapters`. One typed composition root
   (`src/lib/server/container.ts`, server-only) wires adapters from config —
   constructor injection, no DI framework. A boundary-lint test enforces core
   purity.
3. **Persistence: SQLite via better-sqlite3 behind a `StorePort`.** One file in
   the mounted volume; transactional; no separate DB server for the default
   self-hosted deployment. Schema owned by a migration runner
   (`src/lib/adapters/store/migrations/`). Rationale: single-tenant household
   scale is far below where a client/server DB earns its operational cost.
4. **PDF import: `unpdf` (serverless-friendly pdfjs build) behind `PdfTextPort`,
   feeding a `StatementParserPort`.** The PDF port only extracts text + layout
   positions; parsing text into rows is a separate port with per-format
   implementations (generic-tabular, plus a `BankProfile` registry mapping a
   detected header signature to column roles). Rationale: separating text
   extraction from row parsing keeps the fragile, bank-specific logic testable
   with fixture text and free of the PDF binary in unit tests. CSV and OFX are
   sibling `StatementParserPort` adapters.
5. **Idempotent import via content-hash dedup.** Each normalized transaction
   gets a stable hash of (account, booking date, amount, normalized
   description); re-import compares hashes within and across batches.
   **Constraint:** hashing must be locale/whitespace-stable, so description
   normalization (collapse spaces, strip diacritics for the hash only, not for
   display) is defined once in core and shared by every parser.
6. **Classification: an ordered rule engine in core, many-to-many.** A rule is
   `{ when: predicate(tx), assign: groupId[] }`; a transaction is evaluated
   against all rules and accumulates the union of assigned groups (rules are
   additive, not first-match), with an explicit `stopAfter` escape for
   exclusivity when wanted. Unmatched → review queue. Groups are a nestable
   tree + flat cross-cutting tags, both just `Group` nodes with an optional
   parent. **Constraint:** analytics must never assume one-group-per-tx.
7. **Optional categorization assist behind `AssistPort`.** Default adapter is a
   local heuristic (frequency/similarity over past classified descriptions);
   an online LLM adapter (Anthropic Haiku) is opt-in via config and clearly
   off by default. Assist only *suggests*; commit is a user/rule action.
8. **Analytics in core, two attribution modes.** Because a tx can match several
   groups, every group-aggregated metric declares its mode: **overlap** (each
   matched group counts the full amount; totals across groups may exceed the
   grand total) or **partition** (the amount is attributed once — by split
   amounts if the tx was split, else to a designated primary group, else
   evenly). The UI always labels which mode a chart uses. Rationale: silent
   double-counting is the classic multi-tag analytics bug; making mode explicit
   in the domain type prevents it.
9. **Charts: a small dependency-light chart layer.** Use `layerchart` (Svelte-
   native, built on d3 scales) or hand-rolled SVG for income/outcome line/area,
   group bar/treemap. Rationale: Svelte-native keeps charts inside the component
   model and testable; avoid heavyweight canvas libs. Chart *data shaping* lives
   in core analytics, not in components — components render prepared series.
10. **i18n: `@inlang/paraglide-js` (compiled message catalogs) or a minimal
    typed catalog if paraglide is unavailable offline.** Messages compiled to
    TS functions → type-safe keys, tree-shakeable, no runtime catalog fetch.
    Ship `en` and `pl`. Locale drives Intl number/currency/date formatting via a
    single formatting module. **Constraint:** no user-facing string is hardcoded
    in a component; every string is a catalog key (a lint/test guards this).
11. **Config layers:** `config/default.json` < `config/<env>.json` < env vars
    (`COFFER_` prefix, `__` nesting), deep-merged behind `ConfigPort`. Carries
    DB path, default locale, enabled parsers, assist adapter selection + on/off.
12. **BG/Forgotten-Realms design system** under `src/lib/ui/design-system/`:
    parchment/ink palette, ornamental framing, serif display + readable sans for
    data, but **numbers and charts stay high-contrast and legible** — theme is
    chrome, never applied to data legibility. Light (parchment) and dark
    (candlelit) variants via `prefers-color-scheme` + `data-theme` override.
    Accessible: WCAG AA on all text/data, reduced-motion respected.
13. **Tests: vitest (+ @testing-library/svelte) for unit/component; Playwright
    for e2e.** Rationale for Playwright over WebdriverIO here (unlike the Tauri
    dogfood): this is a plain web server, so Playwright's browser automation is
    the standard fit and runs headless in CI/Docker. E2e specs live in `e2e/`.
14. **Docker packaging** — `Dockerfile` (multi-stage: build → node adapter
    runtime) + `docker-compose.yml` with a named volume for the SQLite file and
    a `COFFER_` env block. Authored in a slice; `docker build` verification is
    deferred (no daemon here), documented in `docs/deferred-verification.md`.

## Environment constraints

- TS core + adapters must build and test with `pnpm` alone (no Docker, no keys).
  Network/LLM adapters are constructor-injected and faked in tests.
- Secrets (LLM key for the opt-in assist) only via env/config layer, never in
  repo files.
