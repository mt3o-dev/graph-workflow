# Tech stack & decision record — Interview Copilot

Statements below are normative (the /gw-foundation distillation set). Each
decision carries its why.

## Decisions

1. **Tauri 2 + Svelte 5 + TypeScript, strict.** User-mandated. Rust shell stays
   thin (window, audio permissions, sidecar spawning); all domain logic lives in
   TypeScript so the hexagonal core is testable with vitest alone.
2. **Hexagonal architecture, explicit composition root.** Core (`src/lib/core`)
   imports only its own ports (`src/lib/ports`). Adapters (`src/lib/adapters`)
   implement ports. One composition root (`src/lib/di/container.ts`) wires
   adapters by configuration — constructor injection, no DI framework: a typed
   object-literal container is simpler, tree-shakeable, and honest about the
   object graph.
3. **Embeddings: two adapters behind `EmbeddingsPort`.**
   - Local: `@huggingface/transformers` (transformers.js) running
     `Xenova/all-MiniLM-L6-v2` (384-dim). Rationale: pure-JS/ONNX so it works in
     the Tauri webview or a Node sidecar without Python; GPU via WebGPU when
     present, CPU otherwise; a 100-document KB indexes in seconds even on CPU.
     The Docker+NVIDIA assumption is not *required* for embeddings — that
     hardware budget is spent on Whisper, where it matters.
   - Online: OpenAI `text-embedding-3-small` (truncated to 384 dims via the
     `dimensions` parameter so both adapters share one index geometry).
   - **Constraint:** an index is bound to the embedding model that built it;
     switching adapters requires reindexing. The index records
     `(model, dimensions)` and the app refuses to query a mismatched index.
4. **Vector index: sqlite-vec in the app's SQLite DB.** One local DB file for
   both the vector index and session logs (separate tables). Rationale: no
   server, transactional with the logs, 100–10k docs is far below sqlite-vec's
   comfortable range. Cosine similarity, top-k=4 default.
5. **STT: two adapters behind `TranscriptionPort`.**
   - Local: whisper-derivative served from Docker with NVIDIA GPU —
     `faster-whisper` behind the WhisperLive/streaming-server WebSocket
     protocol; the adapter is a WebSocket client, so any server speaking the
     protocol works.
   - Online: OpenAI Realtime transcription (`gpt-4o-mini-transcribe`) over
     WebSocket.
   - Both emit the same `TranscriptSegment` events (interim/final, timestamps).
6. **Answering: `AnswerPort`, Anthropic Haiku adapter first**
   (`claude-haiku-4-5`). The port takes (question, context window, retrieved
   docs) and returns a grounded draft with source ids. Swapping LLMs is a
   config change, not a code change.
7. **Transcript context window: utterance-based, not token-based.** The
   retrieval query is the detected question utterance plus preceding dialogue
   up to **30 seconds / 6 utterances, whichever is smaller** (both configurable:
   `contextWindow.maxSeconds`, `contextWindow.maxUtterances`). Rationale:
   interview questions are self-contained within a turn or two; a short window
   keeps retrieval precise (long windows drown the question in chit-chat), and
   utterance boundaries follow VAD segmentation, which is the unit the system
   actually observes. The answer engine receives the same window plus the
   retrieved documents.
8. **Turn handling: VAD + question classification.** Silence-gap segmentation
   (configurable `vad.silenceMs`, default 700 ms) closes an utterance; a
   lightweight classifier (interrogative heuristics; port allows an LLM
   classifier later) decides question vs statement. Questions trigger
   retrieval; statements only extend the context window. Speaker attribution
   is heuristic in v1 (accepted gap in the PRD).
9. **Configuration: layered, explicit precedence** —
   `config/default.json` < `config/<env>.json` < user config
   (`~/.config/interview-copilot/config.json`) < environment variables
   (`IC_` prefix, `__` as nesting separator). Deep-merged in that order behind
   `ConfigPort`; adapter selection (`stt.adapter`, `embeddings.adapter`,
   `answer.adapter`) is configuration, never code.
10. **Knowledge base: markdown + frontmatter, git-versioned.** One file per
    question under `kb/<category>/`; frontmatter: `id`, `question`, `category`
    (frontend|backend|theory|behavioral), `difficulty` (easy|medium|hard),
    `expertise` (junior|mid|senior — the seniority the question targets),
    `tags[]`. Body = the prepared answer. The KB adapter parses frontmatter and hands docs to the
    indexer. Human-editable is the point.
11. **Tests: vitest + @testing-library/svelte for unit/component; WebdriverIO +
    tauri-driver for e2e.** Rationale for e2e: tauri-driver is the officially
    supported WebDriver bridge for Tauri on Linux/Windows — matching the
    Docker/Linux deployment assumption; Playwright cannot attach to a Tauri
    webview. E2e specs live in `e2e/` and run against a debug build.
12. **SQLite access from TS via better-sqlite3** (Node sidecar context) wrapped
    behind ports; the Rust shell does not own the schema.

## Environment constraints

- Build machine may lack Rust/GPU: the TS core must build and test standalone
  (`pnpm test`) without cargo, Docker, or any network key. Adapters touching
  network/GPU are constructor-injected and trivially fake-able.
- API keys only via env/user config layer; never in repo files.
