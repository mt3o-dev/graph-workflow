# Interview Copilot

A Tauri 2 + Svelte 5 desktop app that listens to a (mock) job interview,
transcribes it in real time, detects the interviewer's questions, retrieves the
best-matching prepared answers from a personal markdown knowledge base (RAG),
and drafts a grounded answer suggestion — automatically, no push-to-talk.

Built as the **dogfooding project of the graph-workflow** (see
`context/` for the full lifecycle trail: PRD, tech-stack decision record,
plan, plan-review verdict, and the memory backlog).

> **Ethics note:** positioned as a preparation / mock-interview tool. Using it
> covertly in a real interview may violate the interviewing company's policies —
> that responsibility is the user's. The app makes no attempt to hide itself.

## Quick start (web dev mode, no Rust needed)

```sh
pnpm install
pnpm dev            # → Live Session has a demo mode fed by recorded fixtures
```

## Full checks

```sh
pnpm typecheck && pnpm test && pnpm validate:kb && pnpm build
```

## Desktop (needs Rust; see docs/deferred-verification.md)

```sh
pnpm tauri dev          # dev shell
TAURI_BUILD=1 pnpm tauri build
```

## Layout

| Path | What |
|---|---|
| `src/lib/ports/` | The 8 hexagon ports (interfaces only) |
| `src/lib/core/` | Pure domain: turn detection, context window, retriever, answer service, orchestrator |
| `src/lib/adapters/` | STT ×2, embeddings ×2, sqlite-vec index, session log, Haiku answer, markdown KB, layered config |
| `src/lib/di/` | Composition root — adapter selection from config |
| `src/lib/ui/` | Design system (tokens + 14 components) and screens |
| `kb/` | 100-question knowledge base (markdown + frontmatter) |
| `config/` | Layered configuration (defaults < env < user file < `IC_*` env vars) |
| `e2e/` | WebdriverIO + tauri-driver scaffold |
| `docs/` | Architecture (mermaid), deferred verification |
| `context/` | graph-workflow lifecycle files |

See `docs/architecture.md` for diagrams and the port/adapter matrix.
