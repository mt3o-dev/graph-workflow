# TODO / known gaps (slice 1)

Things deliberately left unfinished or simplified for slice 1, per the "be
pragmatic, don't block on infeasible-in-sandbox items" guidance:

- **PWA icons**: raster PNGs (`public/icons/icon-192.png`, `icon-512.png`)
  *were* generated successfully via `bunx sharp-cli` against
  `branding/icon.svg` — image rasterization turned out to be feasible in this
  sandbox. There's no dedicated "maskable" icon with safe-zone padding yet
  (the manifest reuses the plain icon for `purpose: "any"` only); a proper
  maskable icon is a nice-to-have follow-up, not a blocker.
- **Image occlusion drawing tool**: regions are entered as numeric x/y/w/h%
  inputs (spec explicitly says this is fine for slice 1 — "no canvas drawing
  tool required, that's a nice-to-have not a blocker"). A real
  click-and-drag canvas tool is future work.
- **Fragment markup duplication**: `src/lib/fragments.ts` and
  `src/lib/reviewFragments.ts` hand-build HTML strings for htmx partial
  endpoints instead of reusing the `.astro` components used for full-page
  renders. Astro's `astro/container` API could render a single component
  from a plain API route, but wiring it in added more risk than the modest
  duplication — see `docs/architecture.md`. Worth revisiting once there are
  more than two or three fragment shapes.
- **No self-service password change/reset** yet — the seeded admin password
  is a one-time console log. Needed before this goes anywhere near a real
  user.
- **No drizzle-kit generated migrations** — schema changes are hand-rolled
  idempotent DDL (`migrateSqlite.ts` / `migratePg.ts`). Fine for a
  greenfield slice with no prior schema; switch to `drizzle-kit generate` +
  a migrations table once there's real schema history to manage.
- **Session cleanup**: expired sessions are lazily deleted on lookup
  (`getSession`) and there's a `pruneExpiredSessions*` helper exported from
  each auth adapter, but nothing calls it on a schedule yet — fine at slice-1
  scale, wire up a cron/interval later.
- **`llmGeneratorPort.ts`** is an empty interface with no implementation —
  intentional, this is slice 2's seam (`TODO(slice 2)` comment in the file).
- **Rate limiting / brute-force protection** on `/api/auth/login` is not
  implemented.
- **Levenshtein fuzzy-match tolerance** is a simple heuristic
  (`floor(min(len_a, len_b) / 8)`, minimum 1) — good enough to forgive a
  typo or two on longer answers without accepting wrong answers; not tuned
  against real student input.
