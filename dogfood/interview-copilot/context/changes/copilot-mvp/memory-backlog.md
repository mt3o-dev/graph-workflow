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
