# PRD — Interview Copilot

An interview-preparation aid that listens to a live job interview, transcribes it
in real time, detects the interviewer's questions, retrieves the best-matching
prepared answers from a personal knowledge base (RAG), and drafts a grounded
answer suggestion for the interviewee — automatically, without manual triggering.

> **Ethics note (accepted scope):** the product is positioned as a *preparation
> and mock-interview* tool. Using it covertly in a real interview may violate the
> interviewing company's policies; this is the user's responsibility. The app
> makes no attempt to hide itself.

## Personas

- **The candidate** — preparing for CS/software interviews, has a pool of
  prepared answers, wants realtime recall aid during mock interviews.
- **The coach** — runs mock interviews, reviews session logs afterwards.

## Core flow

```mermaid
sequenceDiagram
    participant Mic as Microphone
    participant STT as Transcription (port)
    participant Turn as Turn detector (VAD)
    participant RAG as Retriever (port)
    participant LLM as Answer engine (port)
    participant UI as UI (Svelte)
    participant Log as SQLite log

    Mic->>STT: audio stream (chunks)
    STT-->>Turn: interim + final transcript segments
    Turn->>Turn: segment into utterances,<br/>classify question vs statement
    Turn->>RAG: query = detected question + context window
    RAG-->>LLM: top-k KB documents (with metadata)
    LLM-->>UI: grounded answer draft + source cites
    Turn->>Log: utterance, question, retrieval, answer
    UI-->>UI: auto-updates as conversation flows
```

## Functional requirements

1. **Realtime transcription** from the microphone with two interchangeable
   adapters: local (whisper-derivative served from Docker, NVIDIA GPU) and
   online (OpenAI transcription API). Switchable via configuration.
2. **Automatic turn handling** — no push-to-talk. Voice-activity detection
   segments speech into utterances; a question detector decides when to fire
   retrieval. Reacts to both interviewer and interviewee talking (interviewee
   speech extends context but does not trigger retrieval).
3. **RAG over a markdown knowledge base** — questions/answers as markdown files
   with frontmatter metadata: `category` (frontend, backend, theory,
   behavioral), `difficulty` (junior/mid/senior), `expertise`, `tags`.
   Embedding-based similarity search with two embedding adapters (local model,
   online API); index persisted in SQLite (sqlite-vec).
4. **Grounded answer drafting** via an LLM behind an adapter — Haiku today,
   swappable without touching the core.
5. **Session logging** — every utterance, retrieval, and answer to a local
   SQLite database; browsable per session.
6. **Knowledge base of ≥100 questions** covering frontend, backend, CS theory
   (ACID/BASE, DDD, complexity, networking), and behavioral questions.
7. **Configuration layers** — packaged defaults < environment config < user
   config file < environment variables. Adapter selection lives in config.

## Non-functional requirements

- **Hexagonal architecture** — domain core with ports; adapters at the edges;
  dependency injection via an explicit composition root. Core has zero imports
  from Tauri, network SDKs, or the filesystem.
- **Clean code** — small units, intention-revealing names, tests first-class.
- **Stack**: Tauri 2 + Svelte 5 + TypeScript. Local processing assumes Docker
  with NVIDIA hardware; online adapters must work without any local GPU.
- **Tests**: vitest (+ Testing Library) for unit/component; WebdriverIO +
  tauri-driver for e2e.
- **Privacy**: audio never leaves the machine when local adapters are selected.

## Architecture (target)

```mermaid
flowchart LR
    subgraph Adapters-in [Driving adapters]
        UI[Svelte UI]
        CLI[Session runner]
    end
    subgraph Core [Domain core - no framework imports]
        ORCH[Session orchestrator]
        TURN[Turn detection & context window]
        RETR[Retriever]
        ANS[Answer service]
    end
    subgraph Ports [Ports]
        P1([TranscriptionPort])
        P2([EmbeddingsPort])
        P3([VectorIndexPort])
        P4([AnswerPort])
        P5([SessionLogPort])
        P6([ConfigPort])
        P7([KnowledgeBasePort])
    end
    subgraph Adapters-out [Driven adapters]
        W1[WhisperLocalAdapter\nDocker+NVIDIA]
        W2[OpenAISttAdapter]
        E1[LocalEmbeddingsAdapter\ntransformers.js]
        E2[OpenAIEmbeddingsAdapter]
        V1[SqliteVecIndex]
        L1[AnthropicHaikuAdapter]
        S1[SqliteSessionLog]
        C1[LayeredConfigAdapter]
        K1[MarkdownKbAdapter]
    end
    UI --> ORCH
    ORCH --> TURN --> RETR --> ANS
    ORCH -.-> P1 & P5 & P6
    RETR -.-> P2 & P3 & P7
    ANS -.-> P4
    P1 --- W1 & W2
    P2 --- E1 & E2
    P3 --- V1
    P4 --- L1
    P5 --- S1
    P6 --- C1
    P7 --- K1
```

## Known accepted gaps (v1)

- Single-microphone capture; interviewer/interviewee separation is heuristic
  (VAD turns + question classification), not diarization.
- Whisper local adapter expects an external whisper server (Docker); the app
  does not manage the container lifecycle.
- No answer streaming to the UI in v1 (single completion per question).
- English-language KB and question detection only.
