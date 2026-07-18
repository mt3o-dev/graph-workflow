# Dogfooding report — building Interview Copilot with the graph-workflow

2026-07-18. The workflow was exercised end-to-end on a real greenfield build:
**Interview Copilot** (`dogfood/interview-copilot/`), a Tauri 2 + Svelte 5
realtime interview-RAG app. Opus planned; Sonnet agents implemented; the gw
gates ran as fresh-session subagents. This document records what happened, what
the workflow caught, what it lacked, and what was fixed as a result.

## What was built

Hexagonal TS core (VAD turn detection → question classification → context
window → cosine retrieval → grounded answering) behind 8 ports; adapters:
WhisperLive-WS + OpenAI Realtime STT, transformers.js + OpenAI embeddings
(shared 384-dim index geometry), sqlite-vec index, better-sqlite3 session log,
Anthropic Haiku answering, markdown KB, layered config (defaults < env < user
file < `IC_*` vars); DI composition root; 100-question categorized KB
(frontend/backend/theory/behavioral × 25, validated by a schema gate); design
system (tokens, light/dark, 14 components) + four screens; Tauri 2 shell;
WebdriverIO + tauri-driver e2e scaffold.

Final state: **typecheck 0 errors / 495 files, 156 tests passing (4
network-gated skips), 100 KB docs validating, web + Tauri-static builds green.**
Rust compile, live audio, and e2e execution are deferred to a Rust/GPU machine
(`docs/deferred-verification.md` in the app).

## Lifecycle trail

| Gate | Agent | Outcome |
|---|---|---|
| foundation | main session | PRD + 12-decision tech-stack record |
| gw-new | main session | change `copilot-mvp`, degraded-mode scope (see below) |
| gw-plan | **Opus** | 7 phases, pnpm-only verification per phase |
| gw-plan-review | Sonnet (fresh) | **Request changes** — caught 2 real findings |
| gw-implement | 6 Sonnet agents | phases 1–4, 5, 6 (+4 KB content agents) |
| gw-review | Sonnet (fresh) | **Approve** — 2 minor findings, re-verified green itself |
| gw-archive | main session | folder archived; sweep deferred (no store) |

## What the workflow caught (evidence it works)

1. **gw-plan-review caught a constraint violation before any code existed.**
   The KB frontmatter schema in the plan silently collapsed `difficulty` and
   `expertise` — a drift introduced by a foundation edit racing the planner.
   Cost of catching it at the plan gate: one plan edit. Cost at review: rework
   across 100 KB files.
2. **gw-review caught undisclosed drift** (`/knowledge`,`/sessions` vs planned
   `/kb`,`/log`) and independently re-ran all verification rather than
   trusting the implementers' claims. Both reviews were fresh sessions whose
   only context channel was the recalled constraint set — the design premise
   held up in practice.
3. **The gates consumed the degraded-mode backlog as a stand-in graph** and
   still functioned. Discipline survives the store being down.

## Flaws found → fixed (issues #17–#20)

1. **"Captures are lost, not queued" was wrong guidance** (#17). Queueing works:
   every would-be memory operation went to `memory-backlog.md` and is fully
   replayable. Fixed: degraded mode now *requires* the backlog (standing rule,
   USAGE en/pl, gw-init, gw-archive deferred-sweep protocol).
2. **Foundation amendment concurrency** (#18). tech-stack.md was clarified while
   Opus was mid-plan; the stale schema shipped in the plan and only the gate
   caught it. Fixed: amendments happen between gates or are announced in active
   changes; gates re-read foundation independently as the designed net.
3. **No epic layer** (#19). `copilot-mvp` was an epic wearing one change-id — 7
   phases, 6 agents, multiple review sittings. Fixed: `roadmap.md` is the epic
   registry; slices carry `epic:` in change.md, the epic id as a capture facet,
   sibling surviving nodes as parent_refs; gw-new warns on epic-sized goals;
   gw-archive closes epic entries.
4. **Phase-parallel subagents were unregulated** (#20). Two agents nearly
   collided on build config; an e2e spec assumed a `data-testid` contract the
   UI agent hadn't built (it converged, by prompting and luck). Fixed:
   gw-implement/gw-goal now require disjoint file ownership declared up front,
   cross-phase contracts captured before the consumer starts, per-phase capture
   headings, and orchestrator re-verification of the merged state.

## Observations that are notes, not fixes

- One implementation agent died on a session limit mid-scaffold; resuming it
  with a state delta ("here is what's on disk, continue") worked cleanly — the
  worktree-as-truth model makes agent crashes cheap.
- `rm` being permission-denied for agents left scaffold litter; the review gate
  caught that it was merely disclosed, not resolved. Gitignore was the
  compliant fix.
- The 4 KB content agents and the core agent ran concurrently against disjoint
  paths with zero conflicts — the disjoint-ownership rule in #20 is cheap and
  sufficient in practice.

## Replay debt

The archived change (`context/archive/copilot-mvp/`) carries an unreplayed
`memory-backlog.md`. When agentic-memory is registered for this repo: run
/gw-init + /gw-foundation, replay the backlog (create_change, captures,
events, promotions), then `memory_lifecycle.py deactivate copilot-mvp --sweep`.
