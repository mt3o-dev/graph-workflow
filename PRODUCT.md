# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the human developer/maintainer driving the graph-workflow — supervising what AI agents are doing across changes, issues, and the memory graph, and stepping in to steer. They run pmview locally while agent-driven work is in progress; their job is to orient quickly, spot what needs attention (flagged/contradicted nodes, warnings, stalled changes), and intervene.

## Product Purpose

`pmview` is a local project-management board that gives a single pane over an AI-driven development workflow. It joins three normally-separate views over the same underlying store — changes (by lifecycle stage), issues / flagged backlog, and the agentic-memory knowledge graph — so a human steering autonomous agents can see the whole state at a glance instead of reading raw change folders and memory dumps. Success is the supervisor noticing and resolving what matters without leaving the board.

## Positioning

A unified board that sits directly on the graph-workflow's own artifacts: the change-folder lifecycle and the agentic-memory node/edge graph, with writes proxied to the agentic-memory server. A neighboring general PM tool does not read the change-folder lifecycle or the memory graph, and cannot join issues, changes, and knowledge nodes over one store the way pmview does.

## Operating Context

- Launched locally: `python -m pmview [root ...]` → serves `http://127.0.0.1:8766` (`--open` opens a browser).
- Reads change folders and the memory store directly; optional writes are proxied to the agentic-memory GUI API (default `http://127.0.0.1:8765`, overridable with `--memory-url`).
- Three top-level views plus a detail drawer:
  - **Board** — changes grouped by lifecycle stage, with stat tiles.
  - **Issues** — issue queue and flagged backlog, filterable via pills.
  - **Search** — debounced substring search over nodes.
  - **Detail drawer** — change detail (body, warnings, plan phases, contradiction pairs) and node detail (editable body, facet pills, edges, journal events, resolve and tier actions).
- Can take multiple project roots and switch between them via a project selector.

## Capabilities and Constraints

- **Capabilities:** lifecycle-grouped board; issue queue + flagged backlog with filter pills; debounced node search; detail drawer with editable node body, facets, edges, journal, and resolve/tier actions; multi-root project selector; light/dark rendering via `prefers-color-scheme`.
- **Stack (from existing codebase):** backend is Python **standard library only** (`http.server` / `ThreadingHTTPServer`) — no Flask/FastAPI/Django. Frontend is **vanilla JS + hand-written CSS** — no framework, bundler, or build step. `gui/README.md` records zero-dependency as an architectural invariant; class names are the styling contract between `app.js` and `static/style.css`.
- **Local-only (user-confirmed binding constraint):** runs on `127.0.0.1`; future work must keep it local-first and must not introduce external network dependencies or telemetry.
- **Graceful degradation:** viewing requires no memory server; write actions are proxied to the agentic-memory server and degrade cleanly when it is absent.

## Brand Commitments

Name: **pmview**. No further brand, voice, or identity commitments have been established.

## Evidence on Hand

- Real dogfooded data: tests exercise the HTTP surface against a **committed Coffer memory store** in real dump format (`gui/tests/test_pmview.py`, 41 tests).
- No testimonials, customers, pricing, benchmarks, or press exist — future work must not fabricate any of these.

## Product Principles

1. **One pane over the whole workflow** — changes, issues, and the memory graph share a single surface.
2. **Local-first and dependency-free** — the tool must clone-and-run with no toolchain or build step.
3. **Steering, not just viewing** — surface what needs human attention first (flags, contradictions, warnings, stalled changes).
4. **Additive, never blocking** — viewing always works; write features layer on top without becoming a hard requirement.
