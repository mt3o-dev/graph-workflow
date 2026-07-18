# Plan — copilot-mvp

Phased implementation of the Interview Copilot MVP (see `../../foundation/prd.md`).
Each phase ends in a state verifiable with **pnpm alone** — no cargo, Docker, GPU,
or network keys on the build machine. `[dec:N]` refers to tech-stack.md decision N.

## Environment contract (applies to every phase)
- Node 26 + pnpm. TypeScript strict.
- Verification is `pnpm ...` only. Anything touching network/GPU/Docker is exercised
  through a fake, never a live service.
- Tauri Rust shell is authored but compiles elsewhere; its verification is
  **"cargo check deferred, documented"** — never run on this machine.
- `pnpm typecheck` = `tsc --noEmit`; `pnpm test` = `vitest run`.

## Directory layout (target, created incrementally)
```
config/                      default.json, <env>.json
src/lib/core/                domain logic, no framework/network/fs imports
src/lib/ports/               port interfaces + shared types (TranscriptSegment, KbDoc, ...)
src/lib/adapters/            one dir per port implementation
src/lib/di/container.ts      composition root
src/lib/ui/design-system/    tokens + components
src/routes/                  SvelteKit routes = the four screens
src/test/fakes/              in-memory port fakes + recorded-transcript fixtures
kb/<category>/               markdown Q/A files (frontend|backend|theory|behavioral)
e2e/                         WebdriverIO + tauri-driver specs & config
src-tauri/                   Rust shell (compiled elsewhere)
docs/                        architecture.md
```

---

## Phase 1 — Scaffold + config layers
Implements `[dec:1] [dec:2] [dec:9]`.

- **Files:** `package.json`, `pnpm-lock.yaml`, `tsconfig.json` (strict),
  `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`,
  `config/default.json`, `config/development.json`, `config/test.json`,
  `src/lib/ports/config.port.ts`, `src/lib/adapters/layered-config.adapter.ts`,
  `src/lib/adapters/layered-config.adapter.test.ts`.
- SvelteKit + Svelte 5 + TS strict project. `ConfigPort` with `get<T>(path)`.
  `LayeredConfigAdapter` deep-merges: `config/default.json` < `config/<env>.json`
  < user file (`~/.config/interview-copilot/config.json`) < `IC_`-prefixed env vars
  (`__` nesting separator). Precedence covered by unit tests using injected fake
  fs/env (no real home/env writes).
- `config/default.json` seeds: `stt.adapter`, `embeddings.adapter`,
  `answer.adapter`, `contextWindow.maxSeconds=30`, `contextWindow.maxUtterances=6`,
  `vad.silenceMs=700`, `retrieval.topK=4`.
- **Verify:** `pnpm install && pnpm typecheck && pnpm test`.

## Phase 2 — Ports + domain core with fakes
Implements `[dec:2] [dec:7] [dec:8]`. Core has **zero** imports from Tauri, network
SDKs, or fs.

- **Files (ports):** `src/lib/ports/{transcription,embeddings,vector-index,answer,session-log,knowledge-base,config}.port.ts` + `src/lib/ports/types.ts`
  (`TranscriptSegment`, `Utterance`, `ContextWindow`, `KbDoc`, `RetrievedDoc`,
  `AnswerDraft`).
- **Files (core):** `src/lib/core/turn-detector.ts` (VAD silence-gap segmentation
  `[dec:8]`), `src/lib/core/question-classifier.ts` (interrogative heuristics,
  pluggable), `src/lib/core/context-window.ts` (30s/6-utterance sliding window
  `[dec:7]`), `src/lib/core/retriever.ts` (embeds query → VectorIndexPort top-k),
  `src/lib/core/answer-service.ts` (question+window+docs → AnswerPort),
  `src/lib/core/session-orchestrator.ts` (wires the pipeline; statements extend
  window, questions fire retrieval).
- **Files (fakes/tests):** `src/test/fakes/*.fake.ts` (in-memory each port),
  `src/test/fixtures/transcripts/*.json` (recorded interim/final segment streams),
  and a `.test.ts` beside each core unit.
- Orchestrator tested end-to-end against the recorded-transcript fixtures + fakes:
  a question fixture triggers exactly one retrieval and one answer; a statement
  fixture triggers none but extends the window.
- **Verify:** `pnpm typecheck && pnpm test`.

## Phase 3 — Adapters + contract tests
Implements `[dec:3] [dec:4] [dec:5] [dec:6] [dec:10] [dec:12]`.

- **Files (adapters):**
  - STT `[dec:5]`: `adapters/whisper-local.adapter.ts` (WebSocket client, WhisperLive
    protocol), `adapters/openai-stt.adapter.ts` (Realtime `gpt-4o-mini-transcribe`).
  - Embeddings `[dec:3]`: `adapters/local-embeddings.adapter.ts`
    (`@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-dim),
    `adapters/openai-embeddings.adapter.ts` (`text-embedding-3-small`,
    `dimensions:384`).
  - `adapters/sqlite-vec-index.adapter.ts` `[dec:4]` (cosine, top-k=4; records
    `(model,dimensions)`, refuses mismatched index `[dec:3 constraint]`).
  - `adapters/anthropic-haiku.adapter.ts` `[dec:6]` (`claude-haiku-4-5`).
  - `adapters/sqlite-session-log.adapter.ts` `[dec:12]` (better-sqlite3, same DB
    file as index, separate tables).
  - `adapters/markdown-kb.adapter.ts` `[dec:10]` (gray-matter frontmatter parse).
  - `src/lib/di/container.ts` `[dec:2]`: selects adapters by config; network/GPU
    adapters constructor-injected so fakes drop in.
- **Contract tests:** one shared port-contract suite per port run against BOTH the
  fake and any adapter runnable offline. **Offline-runnable now:** markdown-kb,
  sqlite-vec-index, sqlite-session-log, local-embeddings (downloads model to cache;
  gate behind `IC_TEST_ALLOW_MODEL_DOWNLOAD`, else skip). **Network adapters**
  (openai-stt, openai-embeddings, whisper-local, anthropic-haiku) verified only via
  their contract suite driven against a mocked transport (recorded WS/HTTP frames);
  live paths are non-goals here.
- **Verify:** `pnpm typecheck && pnpm test`.

## Phase 4 — Knowledge base schema + acceptance check
Implements `[dec:10]`, PRD FR6 (≥100 questions). Content authored by parallel
content agents; this phase defines the schema + gate.

- **Files:** `kb/README.md` (schema spec), `kb/frontend/`, `kb/backend/`,
  `kb/theory/`, `kb/behavioral/` (seed 2-3 exemplar files per category),
  `scripts/validate-kb.ts`, `scripts/validate-kb.test.ts`.
- **Frontmatter schema (required, per [dec:10] as clarified):** `id` (unique
  slug), `question`, `category` ∈ {frontend,backend,theory,behavioral},
  `difficulty` ∈ {easy,medium,hard}, `expertise` ∈ {junior,mid,senior} (the
  seniority the question targets), `tags[]` (2–5); body = prepared answer
  (non-empty). [plan-review rework: earlier draft collapsed difficulty/expertise;
  fixed to match dec:10.]
- **Acceptance check** (`validate-kb.ts`): every `kb/**/*.md` parses, schema-valid,
  ids unique, total count ≥100, all four categories present, theory covers
  ACID/BASE, DDD, complexity, networking (tag assertions).
- **Verify:** `pnpm typecheck && pnpm test && pnpm validate:kb` (passes on seed set
  for count<100 with a `--min` override in CI; the ≥100 gate is the content agents'
  exit criterion).

## Phase 5 — Svelte UI: design system + four screens
Implements PRD (Svelte UI driving adapter), `[dec:1] [dec:11]`.

- **Design system** under `src/lib/ui/design-system/`: `tokens.css` (color, spacing,
  type scale, radius), and components `Button.svelte`, `Card.svelte`, `Badge.svelte`,
  `Transcript.svelte`, `AnswerCard.svelte`, `SourceList.svelte` — each with a
  `*.test.ts` (@testing-library/svelte).
- **Four screens as page templates** under `src/routes/`:
  `/` **Live Session** (running transcript, detected question, answer draft +
  source cites, auto-updating), `/kb` **Knowledge Base** (browse/filter KB docs),
  `/log` **Session Log** (per-session utterance/retrieval/answer history),
  `/settings` **Settings** (adapter + config selection surfacing `[dec:9]`).
- Screens bind to core via a Svelte store fed by the orchestrator; in tests the
  store is fed by the Phase-2 fakes/fixtures (no live audio).
- **Verify:** `pnpm typecheck && pnpm test` (component + store tests). No answer
  streaming (accepted gap).

## Phase 6 — Tauri shell + e2e scaffold (config only)
Implements `[dec:1] [dec:11]`.

- **Files:** `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/main.rs` — thin:
  window, mic permission, sidecar spawn), `e2e/wdio.conf.ts` (WebdriverIO +
  tauri-driver against a debug build), `e2e/live-session.e2e.ts` (spec authored,
  skipped by default), `e2e/README.md` (how to run where Rust+tauri-driver exist).
- **Verify:** `pnpm typecheck && pnpm test` pass unchanged. Rust build is
  **cargo check deferred, documented** in `e2e/README.md` — e2e run requires a
  machine with Rust toolchain + tauri-driver; not runnable here.

## Phase 7 — Docs + final wiring
Implements `[dec:2]` (composition root complete), PRD architecture.

- **Files:** `docs/architecture.md` (hexagonal overview + the two mermaid diagrams
  from the PRD, ports/adapters table, config precedence, index/model binding rule),
  finalize `src/lib/di/container.ts` so all real+fake adapters are selectable by
  config, `README.md` (run/test/build matrix, which paths need Rust/GPU/keys).
- Boundary lint: a test asserting `src/lib/core/**` imports only from
  `src/lib/ports/**` (grep-based test) — enforces `[dec:2]` core purity.
- **Verify:** `pnpm typecheck && pnpm test` (incl. the boundary-lint test).

---

## Non-goals (accepted gaps, from PRD)
- No speaker diarization; interviewer/interviewee separation is heuristic
  (VAD turns + question classification).
- App does not manage the Whisper Docker container lifecycle.
- No answer streaming to the UI in v1 (single completion per question).
- English-only KB and question detection.
- No live audio, live STT, live embeddings-API, or live LLM verified on this
  machine — those are exercised only through fakes/mocks.
- No CLI session-runner driving adapter in v1 — the PRD's target architecture
  lists it; MVP ships only the Svelte UI driving adapter. The port surface
  (orchestrator API) is the seam a future CLI attaches to. [plan-review rework:
  scope cut made explicit.]

## Risks & mitigations
1. **Realtime audio + network adapter paths are unverifiable on this machine**
   (no mic/GPU/Docker/keys). *Mitigation:* every such path sits behind a port;
   core is verified with in-memory fakes and recorded-transcript fixtures
   (`src/test/fixtures/transcripts/`), and network adapters via mocked-transport
   contract tests. Live wiring is a separate on-hardware pass.
2. **Embedding-index model binding** — switching embedding adapter silently
   corrupts similarity if geometry differs `[dec:3 constraint]`. *Mitigation:*
   both adapters emit 384-dim; index records `(model,dimensions)` and refuses a
   mismatched query; covered by a sqlite-vec adapter test.
3. **Tauri e2e cannot run here** (no Rust/tauri-driver). *Mitigation:* e2e is
   scaffold + skipped specs + documented run instructions; pnpm verification never
   depends on it, so phases stay green. Cargo check deferred, documented.
4. **Local-embeddings model download** is a network/first-run cost inside an
   otherwise offline suite. *Mitigation:* gate that contract run behind
   `IC_TEST_ALLOW_MODEL_DOWNLOAD`; default CI path uses the fake.
