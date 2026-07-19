# Plan (STUB) — coffer-packaging

Slice 5 of `coffer-mvp`. **Not yet opened as a change** (no change.md); `pending`
in roadmap.md. Thin stub for later /gw-plan expansion.

Paths relative to `dogfood/coffer/`. On-machine verification: `pnpm typecheck` +
`pnpm test` + `pnpm build`. `docker build` and Playwright browser runs are
DEFERRED (no Docker daemon / browser on the build machine) and documented, per
[dec:14]/[dec:13]. Decisions from tech-stack.md.

## Goal
Package Coffer as a self-hosted server: adapter-node build, Dockerfile +
docker-compose with a persistent SQLite volume and `COFFER_` env block, a
Playwright e2e scaffold, and architecture + deferred-verification docs.

## Implements
[dec:14] Docker packaging (multi-stage build → node-adapter runtime,
docker-compose named volume, `COFFER_` env; `docker build` deferred + documented);
[dec:13] Playwright e2e (headless, specs in `e2e/`, run deferred); [dec:1]
adapter-node server. PRD FR7 (one `docker compose up`, persistent volume, no
external services).

## Phases (bullet level)
- **P1 adapter-node server** — confirm `@sveltejs/adapter-node` build output
  (`build/`) and a start script placing the SQLite file at the config DB path.
  Verify: `pnpm build` green here; smoke-check the server entry exists.
- **P2 Dockerfile + compose** — multi-stage `Dockerfile` (deps → build →
  runtime), `docker-compose.yml` with a named volume for the SQLite file and a
  `COFFER_` env block. Verify: authored + lint-parsed only; `docker build`
  DEFERRED → `docs/deferred-verification.md` with exact commands.
- **P3 Playwright e2e scaffold** — `playwright.config.ts`, `e2e/*.spec.ts`
  against the data-testid contract from slice 4; headless. Verify: specs
  typecheck; run DEFERRED (no browser here) → documented.
- **P4 Docs** — `docs/architecture.md` (hexagonal core + ports + adapters +
  composition root, mermaid diagrams of the import→classify→analytics→UI flow),
  `docs/deferred-verification.md` (every skipped check + the exact command to run
  it on a Docker/browser-capable machine), real `README.md`. Verify: docs present,
  mermaid parses.

## Verification approach
Green on this machine == `pnpm typecheck && pnpm test && pnpm build`. Everything
needing a Docker daemon or a browser is authored, skip-guarded, and listed in
`docs/deferred-verification.md` with runnable commands — a partial-but-honest
outcome, matching the epic's degraded-machine constraint.

## parent_refs (on open)
Surviving nodes of all prior slices (composition root, config, container, UI
data-testid contract) + facet `coffer-mvp`.
