# Plan — coffer-ui-i18n (slice 4 of coffer-mvp)

Ship the BG/Forgotten-Realms UI: design system, four screens (dashboard, import,
review, settings) consuming slices 1–3 through the server composition root,
layerchart income/outcome + by-group charts rendering the prepared slice-3
`SeriesSet` DTOs (unclassified series distinct), typed-catalog i18n en+pl with no
hardcoded UI strings, and the single-passphrase auth gate on all routes.

Paths relative to `dogfood/coffer/`. Verification substrate: **Node 26 + pnpm
only** — network to npm OK for install; NO browsers (component tests run in
jsdom). Green == `pnpm typecheck && pnpm test`. `goal_ref` a7655884; decisions
carry `[node:<id>]` provenance.

---

## Design decisions settled at this plan boundary (captured)

- **[node:a0330a47]** i18n mechanism = **hand-rolled typed catalog**, NOT
  paraglide (both permitted by [node:eb704b61]/dec:10). Paraglide's vite
  build-plugin + generated dir + its own SvelteKit locale `handle` would need
  sequencing with the auth `handle` and must run before every `pnpm
  typecheck`/`vitest` — friction on the pnpm-only, jsdom, no-browser substrate
  for a 4-screen en+pl surface. Typed catalog is pure TS: a shared `MessageKey`
  union makes a missing `pl` key a **typecheck failure**. Tripwire back to
  paraglide: message count explodes or ICU pluralization becomes required.
- **[node:4a03791d]** no-hardcoded-string guard (constraint) — vitest file-scan,
  exclusions defined (P2).
- **[node:d8caed23]** auth gate design (P5).
- **[node:2e5f97e2]** fantasy naming register for chrome only (P2/P4).
- **[node:167451f0]** charts = layerchart 2.0.2 pinned; unclassified distinct;
  primary-else-even side of disputed [node:bc0ab42f] taken **openly** (aligned
  with narrowed [node:ac2535ce]), mode label always visible; SVG fallback
  tripwire (P4).
- **[node:f36237e4]** `bigint`→JSON serialization (eed7cc3c's deferred concern):
  `SeriesSet.grandTotalMinor` / `Point.value` cross the `load()`→client boundary
  as decimal **strings**, parsed to `Number` only at the chart/format edge
  (personal-finance magnitudes stay < `Number.MAX_SAFE_INTEGER`), displayed via
  the Intl money formatter. No `bigint` in a devalue payload; core stays bigint.

Consumes: `[node:eed7cc3c]` (chart-series DTO), `[node:0b08fbef]`
(`__unclassified__` series), `[node:57af6589]`/dec:12 (design system),
`[node:74be155e]` (auth), `[node:aeb2d1f6]` (chrome-translated / group names are
user data), `[node:4f66243c]` (core `formatMoney` is NOT a display formatter —
display formatting is THIS slice's `format.ts`), `[node:39129c08]` (theme never
at the expense of number legibility), `[node:1640b1ee]` caveat (already resolved
on disk by the 0b08fbef rework — `byGroupSeriesSets` emits the unclassified
residue so partition series sum to `grandTotalMinor`; the UI must render that
series for a partition chart to read as reconciled).

## New dependencies — ORCHESTRATOR INSTALLS ALL UP FRONT (before any agent runs)

Manifests are orchestrator-owned; agents request, never self-add. Install these
once, up front, so parallel phase-agents build against a stable `package.json`:

| dep | version | scope | why |
|-----|---------|-------|-----|
| `layerchart` | `2.0.2` (pin exact; declares `svelte ^5.0.0` peer) | dep | dec:9 chart layer |
| `@testing-library/svelte` | `5.4.2` | devDep | dec:13 component tests |
| `@testing-library/jest-dom` | `7.0.0` | devDep | DOM matchers |
| `jsdom` | `29.1.1` | devDep | component test environment |

(`@sveltejs/vite-plugin-svelte`, `svelte`, `vitest` already present. No d3 —
layerchart bundles its own scale deps. No paraglide, no browser runner.)

---

## Phases (each ends green under `pnpm typecheck && pnpm test`)

### P1 — Design system + theming
`src/lib/ui/design-system/`: CSS-custom-property tokens (parchment **light** /
candlelit **dark**), serif display + readable sans, ornamental framing
(decorative chrome `aria-hidden`), a11y primitives (Button, Field, Card, Modal),
`reduced-motion` respected. Theme resolution: `prefers-color-scheme` default +
`data-theme` override stamped on `<html>` in `src/app.html` / root layout (SSR
reads a `coffer_theme` cookie to avoid FOUC). **WCAG AA on all text and data**;
numbers/charts stay high-contrast — theme is chrome only ([node:57af6589],
[node:39129c08]). No message strings yet (tokens/primitives are string-free).
**Verify:** `@testing-library/svelte` render + role/contrast-token tests (jsdom).

### P2 — i18n typed catalog + Intl formatting + no-hardcoded-string guard
`src/lib/i18n/`: `keys.ts` (the `MessageKey` union), `messages/en.ts` +
`messages/pl.ts` (`Record<MessageKey, string | ((p)=>string)>`; missing pl key =
typecheck error), `t.ts` (reader), `locale.svelte.ts` (Svelte-5 rune store),
`format.ts` (`Intl.NumberFormat` currency/decimal + `Intl.DateTimeFormat`; the
real money **display** formatter, [node:4f66243c]). Catalog values carry the
**fantasy register** (chrome only, keys stay neutral, [node:2e5f97e2]). Guard:
`src/test/no-hardcoded-strings.test.ts` (modelled on `boundary-lint.test.ts`
file-walk) scanning `src/routes/**` + `src/lib/ui/**` — flags template text
nodes with a letter not inside `{t(...)}`, and static `title/aria-label/
placeholder/alt` values; exclusions: `<script>`/`<style>`, structural attrs
(`class/style/href/id/role/type/name/data-*`), non-alphabetic strings, explicit
allowlist (brand `Coffer`). Group names are user data, never flagged
([node:aeb2d1f6], [node:4a03791d]). **Verify:** catalog exhaustiveness via
typecheck; guard test green on the (still string-free) tree.

### P3 — UI server binding + DTO serialization boundary
`src/lib/server/` load-facing helpers over the existing `Container`
([`src/lib/server/container.ts`] — already server-only; `load()`s call it, never
an adapter directly, [dec:2]). Add `src/lib/server/serialize.ts`: map
`SeriesSet`/`Point` `bigint` minor units → decimal **strings** for the
`load()`→client boundary; client re-parses to `Number` only at the chart/format
edge ([node:f36237e4]). Route `+page.server.ts` loaders for dashboard/import/
review/settings shape typed page data. **Verify:** loader/serializer unit tests
through `Container` fed by the existing `src/test/fakes` in-memory stores;
round-trip bigint→string→Number exactness test.

### P4 — Four screens + charts
`src/routes/`: `/` **dashboard** (charts), `/import`, `/review`, `/settings`
(+ `+page.svelte` / `+page.server.ts`). `src/lib/ui/charts/`: layerchart 2.0.2
components rendering the serialized DTOs — cashflow income/outcome/net over time
(line/area) + by-group (bar). **AttributionMode label always visible** on group
charts; `__unclassified__` series rendered **distinctly** (muted/hatched, off
the group palette) ([node:0b08fbef], [node:167451f0]). Primary-else-even side of
disputed [node:bc0ab42f] taken openly; plan does NOT adjudicate the pending
split ruling. All chrome via `{t(...)}`; `data-testid` contract seeded for
slice-5 e2e. **Fallback tripwire:** if layerchart won't mount under Svelte 5.56
in a jsdom test or its peers refuse `svelte@5`, drop to hand-rolled SVG chart
components rendering the SAME DTOs (dec:9 permits). **Verify:**
`@testing-library/svelte` screen tests (jsdom) fed by fixtures/fakes; chart
renders unclassified + mode label; no-hardcoded-string guard stays green.

### P5 — Auth gate (all routes) + login/logout
`src/hooks.server.ts` `handle` composed via `sequence()` with a
locale-negotiation handle; gates ALL routes incl `/api/**` — unauthed page GET →
`303 /login`, unauthed API/non-GET → `401`; `/login` + static assets exempt.
`src/lib/server/auth/*.ts` (server land, all `node:crypto` here — NEVER core,
[dec:2]): `verifyPassphrase` (`timingSafeEqual` over equal-length SHA-256
digests — constant-time, no length leak), `issueSession`/`verifySession`
(HMAC-SHA256 signed `coffer_session` cookie, HttpOnly+Secure+SameSite=Lax).
Passphrase from `config.get('auth.password')` (env `COFFER_AUTH__PASSWORD`; add
`auth` block to `config/default.json` with no default → fail-closed).
Session-signing secret from `config.get('auth.secret')` (env
`COFFER_AUTH__SECRET`) — required in production; absent in dev → random
per-boot secret (sessions die on restart, acceptable; production refuses to
boot without it) [plan-review rework, node 512a3d11].
`/login/+page.svelte` (design system, i18n'd) + `/login/+page.server.ts` action
sets cookie; `/logout` action clears it ([node:d8caed23], [node:74be155e]).
**Verify:** hook + auth-module unit tests (fake ConfigPort/cookies) — gated
redirect, 401 on API, constant-time compare, cookie sign/verify round-trip,
tamper rejection, `/login` exemption.

### P6 — Integration seam + full green
Wire theme cookie + locale + auth `locals` through the root layout; confirm the
no-hardcoded-string guard covers all shipped routes; end-to-end typed page-data
smoke through fakes. **Verify:** full `pnpm typecheck && pnpm test` green;
`data-testid` contract documented for slice-5 Playwright e2e.

## Phase-parallel ownership (disjoint paths)

- **P1** (`src/lib/ui/design-system/`) and **P2** (`src/lib/i18n/` +
  `src/test/no-hardcoded-strings.test.ts`) are fully disjoint → **parallel
  agents** after deps land.
- **P5** (`src/hooks.server.ts`, `src/lib/server/auth/`, `/login`, `/logout`,
  `config/default.json`) touches disjoint paths from P1/P2/P3 → can run **in
  parallel** with them; only shares the design system + i18n catalog as
  read-time deps (login screen), so start P5 after P1/P2 land their public
  surface, or stub the login markup and backfill chrome.
- **P3** (`src/lib/server/serialize.ts` + loaders) depends on nothing UI-side →
  parallel with P1/P2.
- **P4** is the **join** — depends on P1 (primitives), P2 (catalog), P3
  (serialized data) → runs after those three. Single owner.
- **P6** integration → last, single owner (orchestrator).
- Manifests orchestrator-owned; the deps table above is installed up front so no
  agent edits `package.json`.

## Non-goals

- No packaging / Dockerfile / adapter-node build / Playwright e2e run (slice 5;
  P4 only seeds the `data-testid` contract).
- No FX / currency conversion (accepted gap; display-only per user rates later).
- No transaction **splits** — the split-amount attribution branch is DISPUTED
  ([node:bc0ab42f]) and DEFERRED ([node:ac2535ce]); UI ships primary-else-even
  only and does not adjudicate.
- No real bank data — fixtures/fakes only.
- No multi-user accounts; single passphrase only.
- No new core/analytics logic — components render prepared series, no data
  shaping in components ([node:eed7cc3c]/dec:9).

## Risks + mitigations

- **layerchart vs Svelte 5** — peer declares `svelte ^5.0.0` (2.0.2), but runes
  API friction possible. *Mitigation:* hand-rolled SVG fallback (dec:9) on the
  stated tripwire; keep chart components thin over the DTO so a swap is local.
- **Auth hook ordering** — an over-broad gate can lock out `/login` or static
  assets, or leak past `/api`. *Mitigation:* explicit exempt-list + tests for
  redirect, 401, and exemption; fail-closed when passphrase unset.
- **Partition reconciliation misread** — a partition chart omitting
  `__unclassified__` implies false exact reconciliation ([node:1640b1ee]
  caveat). *Mitigation:* chart MUST render the unclassified series
  ([node:0b08fbef]); test asserts its presence in partition mode.
- **`bigint` in devalue** — SvelteKit can't serialize `bigint`. *Mitigation:*
  string boundary + round-trip exactness test ([node:f36237e4]).
- **Guard false-positives/negatives** — a regex scan can over/under-flag.
  *Mitigation:* explicit allowlist + attribute set; group names never in markup
  literals (they're user data via `{...}`).
- **Vitest jsdom vs server tests** — client (jsdom) and server (node) tests in
  one run. *Mitigation:* per-file `// @vitest-environment jsdom` on component
  tests (or a vitest projects split) so server tests keep the node env.

## parent_refs (on open)
Surviving nodes of coffer-analytics (chart-series DTOs `eed7cc3c`, unclassified
`0b08fbef`, disputed `bc0ab42f`, narrowed `ac2535ce`, caveat `1640b1ee`),
coffer-classification (review queue, groups), coffer-core-import (import
pipeline, config, `Container`), the auth amendment `74be155e`, plus foundation
design/i18n nodes `57af6589`/`eb704b61`/`aeb2d1f6`/`4f66243c`/`39129c08` and
facet `coffer-mvp`.
