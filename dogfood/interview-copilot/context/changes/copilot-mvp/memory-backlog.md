# Memory backlog — would-be graph operations (degraded mode)

Replay these against the MCP surface after /gw-init + /gw-foundation run for real.

## create_change
- change_id: copilot-mvp, goal: (see change.md), parent_refs: [foundation nodes for
  hexagonal-architecture constraint, adapter-selection-via-config decision]

## capture_artifact (plan boundary — see plan.md)
(appended during planning/implementation below)

- decision: MVP is delivered in 7 phases each verifiable with `pnpm` alone
  (typecheck + vitest); no cargo/Docker/GPU/network-key step is ever on the
  critical path. DEPENDS_ON tech-stack env-constraint (TS core builds standalone).
- decision: Domain core, all ports, and the orchestrator are built and tested
  first (Phase 2) against in-memory port fakes plus recorded-transcript JSON
  fixtures — before any real adapter exists. DEPENDS_ON [dec:2] hexagonal
  architecture, [dec:7] context window, [dec:8] turn handling.
- constraint: `src/lib/core/**` may import only from `src/lib/ports/**`; enforced
  by a grep-based boundary-lint test in Phase 7. DEPENDS_ON [dec:2].
- decision: Adapters are verified through one shared port-contract suite run
  against both the fake and (for offline-runnable adapters) the real
  implementation; network adapters (OpenAI STT/embeddings, WhisperLive, Haiku)
  are driven against a mocked transport with recorded frames, never a live
  service. DEPENDS_ON [dec:3][dec:4][dec:5][dec:6] adapter set, env-constraint.
- constraint: The sqlite-vec index records `(model, dimensions)` and refuses to
  query a mismatched index; both embedding adapters emit 384-dim so they share
  one index geometry. DEPENDS_ON [dec:3] embeddings, [dec:4] vector index.
- decision: The 100-question KB is treated as a schema + acceptance-gate
  deliverable (Phase 4): `scripts/validate-kb.ts` asserts frontmatter schema,
  unique ids, count ≥100, all four categories, and theory topic coverage; the
  content itself is produced by parallel content agents. DEPENDS_ON [dec:10] KB
  markdown+frontmatter, PRD FR6.
- decision: The Svelte UI ships a design system (tokens + components) under
  `src/lib/ui/design-system/` and exactly four page-template screens (Live
  Session, Knowledge Base, Session Log, Settings) under `src/routes/`, bound to
  the core via a store fed by fakes/fixtures in tests. DEPENDS_ON [dec:1] stack,
  [dec:11] test tooling.
- decision: The Tauri Rust shell and WebdriverIO+tauri-driver e2e suite are
  authored but not run on this machine — e2e is scaffold + skipped specs +
  documented run instructions; Rust verification is "cargo check deferred,
  documented". DEPENDS_ON [dec:1] Tauri, [dec:11] e2e tooling, env-constraint.

## capture_artifact (plan-review rework)
- type: decision — "KB frontmatter separates difficulty (easy|medium|hard) from
  expertise (junior|mid|senior target); plan-review caught the plan collapsing
  them; schema follows tech-stack dec:10 as clarified 2026-07-18."
  edges: DEPENDS_ON dec:10; CONTRADICTS the plan's earlier collapsed schema.
- type: decision — "CLI session-runner driving adapter is out of MVP scope,
  explicitly; orchestrator API is the seam it attaches to later."
  edges: DEPENDS_ON PRD target architecture.

## capture_artifact (implementation phases 1-4)
- constraint: better-sqlite3 12.11.1 and sqlite-vec 0.1.9 build and load cleanly
  on this machine (Node 26.2, linux-arm64), so the sqlite adapters run real
  in-memory integration tests — the planned "in-memory JSON fallback adapter"
  guard was NOT needed and was not built. DEPENDS_ON [dec:4][dec:12].
- constraint: pnpm 11 blocks dependency build scripts by default; native deps
  require `allowBuilds: {better-sqlite3: true, esbuild: true}` in
  pnpm-workspace.yaml or `pnpm install` silently skips the node-gyp build and
  better-sqlite3 fails at require time with "could not locate bindings".
- decision: `@huggingface/transformers` is NOT in package.json (it pulls
  onnxruntime, hundreds of MB); LocalEmbeddingsAdapter lazy-imports it by
  string id inside a try/catch and throws an actionable install hint when
  absent. Its real-model contract run is skipped unless
  IC_TEST_ALLOW_MODEL_DOWNLOAD=1 (and the package is installed). DEPENDS_ON
  [dec:3], plan risk 4.
- constraint: with `rewriteRelativeImportExtensions` (SvelteKit's generated
  tsconfig), `.ts`-suffixed imports are only legal on RELATIVE specifiers —
  `$lib/x.ts` alias imports fail typecheck; test helpers under src/test use
  relative paths into src/lib for this reason.
- decision: the boundary-lint test (plan had it in Phase 7) was pulled forward
  into this slice as src/test/boundary-lint.test.ts: ports may import only
  ports; core only core+ports; no package/builtin imports in either. Passing
  since Phase 2 landed. DEPENDS_ON [dec:2].
- decision: shared port-contract suites live in src/test/contracts/*.contract.ts
  (helper modules, not test globs) and are executed by fakes.contract.test.ts
  for every fake and by each adapter's *.adapter.test.ts for the real
  implementation (sqlite pair + markdown-kb offline; whisper/openai-stt via a
  scripted MockWebSocket; openai-embeddings/anthropic-haiku via a mocked fetch
  returning deterministic vectors / citing drafts). DEPENDS_ON plan Phase 3.
- decision: SessionOrchestrator serializes segment handling through an internal
  promise queue (enqueue/idle) so a sync onSegment callback cannot interleave
  retrieval/answer work; port failures surface as 'error' events, never
  unhandled rejections.
- decision: validate-kb.ts exports validateKb() (unit-tested against temp-dir
  KBs and the real kb/) and additionally enforces category-matches-directory;
  theory coverage is asserted via tag allowlists (acid; base|eventual-consistency;
  ddd|domain-driven-design; big-o|complexity|complexity-analysis;
  networking|tcp|dns) chosen to match the content agents' actual tags.
  Full gate passes: 100 docs, 25 per category. DEPENDS_ON [dec:10], PRD FR6.
- issue: `rm`/file-deletion is denied by the session's permission policy, so
  two scaffold leftovers remain on disk: .scaffold-tmp/ (gitignored) and
  src/lib/vitest-examples/ (excluded from the vitest suite via vite.config.ts);
  delete both manually.
- decision: kb/ seed exemplars were intentionally NOT written — all four
  category directories already held the content agents' 100 valid files at
  implementation time; only kb/README.md (schema spec) was added, per the
  "only if the category directory is still missing" instruction.

## process note (dogfood finding, workflow-level)
- Foundation doc (tech-stack dec:10) was amended WHILE the planner was reading it;
  no amendment flow ran because the memory surface was down. The plan-review gate
  caught the resulting drift — evidence the gate works, and evidence degraded
  mode needs a doc-edit discipline too.

## capture_artifact (phase 6)
- decision: there is no `svelte.config.js` in this project — SvelteKit config
  (including the `adapter`) is passed directly as options to the `sveltekit()`
  vite plugin inside `vite.config.ts` (supported since @sveltejs/kit 2.62;
  confirmed by reading `node_modules/@sveltejs/kit/src/exports/vite/index.js`).
  So the plan's "svelte.config.js you may edit (adapter change)" allowance was
  actually exercised against `vite.config.ts` instead — same effect, different
  file. DEPENDS_ON plan Phase 1 scaffold, this phase's adapter switch.
- decision: adapter selection is env-gated (`TAURI_BUILD=1`) inside
  `vite.config.ts`: `adapter-auto` (existing web dev/CI path, unchanged) vs.
  `adapter-static` with `fallback: 'index.html'` (SPA build for the Tauri
  webview, matching `tauri.conf.json`'s `frontendDist: "../build"`). Verified
  both `pnpm build` (adapter-auto, exit 0, prints its usual "could not detect
  environment" warning — unchanged from before this phase) and
  `TAURI_BUILD=1 pnpm build` (adapter-static, writes `build/index.html` +
  `build/_app/`) actually run to completion on this machine. New scripts
  `tauri:build`/`tauri:dev` set the env var via `cross-env` (added as a
  devDependency) so it also works on Windows.
- decision: `@wdio/globals` had to be added as an explicit devDependency
  (not just `webdriverio`/`@wdio/cli`) — the e2e specs import `browser`/`$`/`$$`
  from it directly, per the standard wdio TS authoring pattern, and it was not
  hoisted/available as a bare import otherwise. DEPENDS_ON plan Phase 6 e2e
  scaffold.
- decision: `pnpm test:e2e` = `tsx e2e/preflight.ts && wdio run e2e/wdio.conf.ts`.
  `preflight.ts` exits 1 (not 0) when `tauri-driver` or the debug binary is
  missing — deliberately, to short-circuit the `&&` chain before wdio tries
  (and hangs) attaching to a nonexistent driver. Verified the skip path here:
  clean exit 1 with an actionable message, no hang. Neither
  `pnpm typecheck`/`pnpm test`/`pnpm build` depend on this script, so it never
  blocks the required-green pipeline. DEPENDS_ON plan Phase 6 risk 3.
- decision: e2e specs (`smoke.e2e.ts`, `live-session.e2e.ts`) encode a
  `data-testid` selector contract (`nav-*`, `screen-*`, `start-demo-session`,
  `transcript`, `answer-card`, `source-list`/`source-item`,
  `uncaught-error-banner`) documented in `e2e/README-e2e.md`, since the UI
  layer (owned by another agent this round — `src/lib/ui`, `src/routes`) was
  still in progress and its actual testids were unknown at authoring time.
  Whoever finishes the four screens should either satisfy this contract or
  update the two spec files to match. NEEDS_FOLLOWUP.
- decision: Rust shell kept to exactly two commands per plan.md: 
  `get_app_data_dir` (real, returns the Tauri app-data path so the TS
  composition root can place its SQLite DB there instead of hardcoding a
  path) and `spawn_sidecar_hint` (deliberate stub — always returns an `Err`
  explaining that Whisper-container lifecycle management is a v1 non-goal).
  Both are wrapped in `src/lib/tauri/bridge.ts`, the only file allowed to
  import `@tauri-apps/api`, guarded by `isTauri()` so pure-web dev mode
  (`pnpm dev`, vitest, jsdom) never touches Tauri globals. DEPENDS_ON
  tech-stack dec:1 (thin Rust shell), plan Phase 6.
- constraint: none of `src-tauri/` was ever run through `cargo check` or
  `tauri build` — no Rust toolchain on this machine. Full list of deferred
  checks + exact commands to run them elsewhere is in
  `docs/deferred-verification.md`. Icons under `src-tauri/icons/` are
  hand-generated solid-color placeholder PNGs (via
  `scripts/generate-tauri-icons.ts`, a small dependency-free PNG encoder) —
  valid files so `tauri build` won't choke on missing paths, but NOT a real
  app icon; replace via `pnpm tauri icon <source.png>` before shipping.
  DEPENDS_ON plan Phase 6 risk 3, tech-stack env constraints.
- decision: `capabilities/default.json` grants only `core:default` plus a
  few narrow window/path permissions — no dedicated mic plugin permission,
  because desktop mic capture goes through the webview's standard
  `navigator.mediaDevices.getUserMedia` (OS-permission-gated), not a Tauri
  plugin. Documented inline in the capability file's `description` so this
  isn't mistaken for an oversight later.

## capture_artifact (phase 5)
- decision: the Live Session screen always runs in "demo mode" — a real,
  unmodified `SessionOrchestrator` + `Retriever` wired entirely to
  `src/test/fakes/*` and driven by replaying `src/test/fixtures/transcripts/
  *.json` through `FakeTranscription` at (scaled) real timing, via a new
  `src/lib/ui/stores/live-session.svelte.ts` class store (Svelte 5 runes:
  `$state` fields, no external store library). There is no path from the
  browser to real adapters (better-sqlite3, node:fs, network) — that's a
  server-only concern (see below) — so this is the only way to make the
  screen "fully explorable without audio" per the phase brief. Speaker
  attribution (`interviewer`/`interviewee`) is a UI heuristic derived from
  the question/statement classification, not diarization (PRD accepted
  gap) — documented in `design-system.md` rule 2.
- decision: `TurnDetector` only closes an utterance on the *next* segment's
  silence gap or on explicit `stop()`/flush — so a fixture's trailing
  question would never resolve during pure playback. `LiveSessionStore`
  auto-calls `stop()` ~300ms after the last scheduled fixture segment,
  which flushes the pending utterance through retrieval+answer before
  settling into `status: 'stopped'`. Verified via
  `live-session.svelte.test.ts` (3 tests, one per fixture + reset).
- decision: `/knowledge`, `/sessions`, `/settings` load real data through a
  new server-only composition root, `src/lib/server/container.server.ts`
  (`getServerContainer`/`getServerConfig`), which is the *only* place the UI
  reaches past ports/core into `createContainer` — never an adapter
  directly. SvelteKit enforces `src/lib/server/**` never reaches the client
  bundle, so native deps (better-sqlite3) and `node:fs` are safe there. No
  network-calling adapter method is ever invoked from a load function (only
  `config.get`, `kb.listDocs/getDoc`, `sessionLog.*` — all local).
  DEPENDS_ON [dec:2] hexagonal purity, hand-off point for future CLI runner.
- decision: config-layer provenance ("which layer set each value", per the
  phase brief) is NOT built into `LayeredConfigAdapter` (out of scope —
  don't modify ports/core/adapters). Instead
  `src/lib/server/config-provenance.server.ts` independently re-reads the
  same four layers via the adapter's already-exported `deepMerge`/
  `envToObject` helpers and reports, per dotted path, the last layer that
  defined it. The whole Settings screen is inherently read-only —
  `ConfigPort` has no write method — so this is display-only by
  construction, not an enforced UI restriction.
- decision: composition-root config convention established here (first real
  non-test wiring of `LayeredConfigAdapter`): `configDir: 'config'`,
  `envName: process.env.NODE_ENV ?? 'development'`, `userConfigPath:
  'config/local.json'` — the last matches a `.gitignore` entry
  (`/config/local.json`) that already existed from an earlier phase,
  confirming that was the intended user-config path.
- decision: added `@testing-library/svelte@5.4.2`, `@testing-library/
  jest-dom@6.9.1`, `jsdom@29.1.1` as devDependencies and a second vitest
  "client" project (`environment: 'jsdom'`, `resolve.conditions:
  ['browser']`, `include: ['src/**/*.svelte.{test,spec}.{js,ts}']` — the
  glob the pre-existing "server" project already excluded) alongside the
  existing "server" project in `vite.config.ts`. `@testing-library/svelte`
  does not auto-register cleanup outside Vitest "globals" mode, so
  `src/test/setup-client.ts` explicitly calls `afterEach(() => cleanup())`
  (first symptom without it: `getByRole` "multiple elements found" from a
  previous test's un-unmounted DOM leaking into the next).
- decision: `AnswerCard`'s confidence badge is the top retrieved-doc cosine
  score (`Math.max(...sources.map(s => s.score))`) — there is no dedicated
  confidence field on `AnswerDraft`/`RetrievedDoc`; documented as a design
  rule so it isn't mistaken for a port concept later.
- constraint: a nested `**/` sequence inside a `/** */` JSDoc comment closes
  the comment early (TS parses it as the end-of-comment token), producing
  cascading "Expression expected" errors on unrelated lines below — hit
  this writing a doc comment that mentioned a `kb/**/*.md` glob literally;
  fixed by rewording, not escaping (no escape exists inside a block
  comment).
- constraint: found `pnpm-workspace.yaml` mid-edit with an invalid
  `allowBuilds` value (`edgedriver: set this to true or false`, a literal
  placeholder), which made every `pnpm install`/`build`/`test` fail with
  `ERR_PNPM_IGNORED_BUILDS` before any Phase 5 work could run. Fixed to
  `false` for both `edgedriver`/`geckodriver` (this phase never needs their
  native builds) — a genuine pre-existing repo defect, not something this
  phase introduced.
- decision: added the `data-testid` attributes the Phase 6 e2e specs
  already assumed (`e2e/README-e2e.md`'s "selector contract", flagged
  NEEDS_FOLLOWUP above) — `nav-live/nav-kb/nav-log/nav-settings` on
  `AppNav.svelte`, `screen-live/screen-kb/screen-log/screen-settings` on
  each route's root, `start-demo-session`/`transcript`/`answer-card` on the
  Live Session screen, `source-list`/`source-item` inside `AnswerCard`, and
  an app-wide `<svelte:boundary>` in `+layout.svelte` rendering
  `uncaught-error-banner` only in its `failed` snippet (so it's absent from
  the DOM on the happy path, matching the e2e assertion). `Button.svelte`
  gained a `'data-testid'?: string` prop (same pattern as `aria-label`) to
  let it forward through. Verified present in SSR HTML for all four routes
  via `curl` against a dev server. NOT verified against the actual e2e
  specs (no Rust/tauri-driver on this machine — same constraint Phase 6
  documented).
