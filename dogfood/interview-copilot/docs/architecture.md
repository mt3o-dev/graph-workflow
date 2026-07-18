# Architecture — Interview Copilot

Hexagonal (ports & adapters), dependency direction always inward. The core has
zero imports from SvelteKit, Tauri, network SDKs, or node builtins — enforced by
a boundary-lint test in the suite.

## The hexagon

```mermaid
flowchart TB
    subgraph Driving [Driving side]
        UI[Svelte UI<br/>4 screens]
        DEMO[Demo mode<br/>recorded fixtures]
        E2E[e2e / tests]
    end
    subgraph Core [src/lib/core — pure TS]
        ORCH[SessionOrchestrator]
        TURN[TurnDetector<br/>VAD gaps 700ms]
        QC[QuestionClassifier]
        CW[ContextWindow<br/>≤30s / ≤6 utterances]
        RETR[Retriever<br/>cosine top-4]
        ANS[AnswerService]
    end
    subgraph PortsL [Ports — src/lib/ports]
        TP([TranscriptionPort])
        EP([EmbeddingsPort])
        VP([VectorIndexPort])
        AP([AnswerPort])
        SP([SessionLogPort])
        CP([ConfigPort])
        KP([KnowledgeBasePort])
    end
    subgraph Driven [Driven adapters — src/lib/adapters]
        W1[WhisperLive WS<br/>Docker+NVIDIA]
        W2[OpenAI Realtime STT]
        E1[transformers.js<br/>MiniLM 384d]
        E2[OpenAI embeddings<br/>3-small @384d]
        V1[sqlite-vec]
        A1[Anthropic Haiku]
        S1[better-sqlite3 log]
        C1[Layered config]
        K1[Markdown KB]
    end
    UI --> ORCH
    DEMO --> ORCH
    E2E --> UI
    ORCH --> TURN --> QC
    ORCH --> CW
    ORCH --> RETR --> ANS
    ORCH -.-> TP & SP & CP
    RETR -.-> EP & VP & KP
    ANS -.-> AP
    TP --- W1 & W2
    EP --- E1 & E2
    VP --- V1
    AP --- A1
    SP --- S1
    CP --- C1
    KP --- K1
```

## Runtime flow (one question)

```mermaid
sequenceDiagram
    participant STT as TranscriptionPort
    participant TD as TurnDetector
    participant QC as QuestionClassifier
    participant CW as ContextWindow
    participant R as Retriever
    participant A as AnswerService
    participant UI as Live Session UI
    participant LOG as SessionLogPort

    STT-->>TD: TranscriptSegment (interim/final)
    TD->>TD: close utterance on 700ms silence
    TD->>QC: final utterance
    alt question detected
        QC->>CW: assemble window (≤30s / ≤6 utt)
        CW->>R: query = question + window
        R->>R: embed → cosine top-4 vs KB index
        R->>A: docs + question + window
        A-->>UI: grounded draft + source ids
        A->>LOG: question, retrieval, answer
    else statement
        QC->>CW: extend window only
    end
```

## Adapter matrix

| Port | Local (Docker/NVIDIA budget) | Online | Selected by |
|---|---|---|---|
| TranscriptionPort | WhisperLive-protocol WS client | OpenAI Realtime (`gpt-4o-mini-transcribe`) | `stt.adapter` |
| EmbeddingsPort | transformers.js `all-MiniLM-L6-v2` (384d) | OpenAI `text-embedding-3-small` @ `dimensions: 384` | `embeddings.adapter` |
| AnswerPort | — (future: local LLM) | Anthropic `claude-haiku-4-5` | `answer.adapter` |

Shared index geometry (384 dims) keeps one sqlite-vec index valid for either
embeddings adapter; the index records `(model, dimensions)` and refuses
mismatched queries — switching models means reindexing, by design.

## Configuration layers (lowest → highest precedence)

```
config/default.json  <  config/<env>.json  <  ~/.config/interview-copilot/config.json  <  IC_* env vars (`__` nesting)
```

Adapter selection, VAD gap, context-window limits, top-k are all config, never
code. The Settings screen displays which layer won for each value.

## Testing strategy

| Layer | Tool | What |
|---|---|---|
| Core | vitest + in-memory fakes | unit + recorded-transcript fixture walk-through |
| Ports | shared contract suites | every fake AND every offline-runnable adapter |
| Adapters (network) | mocked transport | protocol framing, error paths |
| UI | vitest + Testing Library (jsdom) | components + live-session store over fixtures |
| E2e | WebdriverIO + tauri-driver | smoke + demo-mode answer flow (runs on a Rust machine; see deferred-verification.md) |

## Rust shell (src-tauri)

Deliberately thin: window bootstrap, `get_app_data_dir`, and a
`spawn_sidecar_hint` stub marking the seam where Whisper-container lifecycle
management would attach (a v1 non-goal). All domain logic stays in TypeScript.
