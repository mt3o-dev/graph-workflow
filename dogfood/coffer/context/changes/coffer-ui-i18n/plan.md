# Plan (STUB) — coffer-ui-i18n

Slice 4 of `coffer-mvp`. **Not yet opened as a change** (no change.md); `pending`
in roadmap.md. Thin stub for later /gw-plan expansion.

Paths relative to `dogfood/coffer/`. Verification: `pnpm typecheck` + `pnpm test`
(vitest + @testing-library/svelte, jsdom) only. Decisions from tech-stack.md.

## Goal
Ship the BG/Forgotten-Realms design system and four screens (dashboard, import,
review, settings) consuming slices 1–3 through a server composition root, with
layerchart income/outcome + group charts and paraglide (en+pl) i18n — data stays
high-contrast and legible; no hardcoded UI strings.

## Implements
[dec:12] BG design system (parchment/candlelit, light+dark via
`prefers-color-scheme` + `data-theme`, WCAG AA, reduced-motion; theme is chrome,
never applied to number/chart legibility); [dec:10] i18n via `@inlang/
paraglide-js` (or a minimal typed catalog if paraglide is offline-unavailable),
en+pl, Intl number/currency/date formatting in one module, no hardcoded string
(lint/test guard); [dec:9] layerchart / hand-rolled SVG rendering prepared
series from slice 3; [dec:1] SvelteKit routes; [dec:13] @testing-library/svelte.
PRD FR4, FR5, FR6.

## Phases (bullet level)
- **P1 Design system** — tokens (palette, type: serif display + readable sans),
  ornamental framing, light/dark, a11y primitives under
  `src/lib/ui/design-system/`. Verify: component render + a11y tests.
- **P2 i18n scaffold** — paraglide (or typed catalog) messages `en`+`pl`,
  Intl formatting module, no-hardcoded-string lint/test. Verify: catalog
  compile + guard test.
- **P3 Server composition root for UI** — `src/lib/server/container.server.ts`
  exposing core/ports to load functions (never an adapter directly); native deps
  stay server-only. Verify: load-function tests via fakes.
- **P4 Four screens** — `/` dashboard (charts), `/import`, `/review`,
  `/settings` under `src/routes/`, bound via runes stores fed by
  fakes/fixtures in tests; layerchart income/outcome + group charts consuming
  slice-3 series. Verify: @testing-library/svelte screen tests; data-testid
  contract for slice-5 e2e.

## Verification approach
Second vitest "client" project (jsdom, browser conditions) alongside the server
project. Green == `pnpm typecheck && pnpm test`. Charts render prepared series
only; no data shaping in components ([dec:9]). No-hardcoded-string test enforces
[dec:10]. Design tokens never override data legibility ([dec:12]).

## parent_refs (on open)
Surviving nodes of coffer-analytics (chart-series DTOs), coffer-classification
(review queue, groups), coffer-core-import (import pipeline, config, container)
+ facet `coffer-mvp`.
