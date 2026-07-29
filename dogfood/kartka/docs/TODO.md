# TODO / known gaps

Things deliberately left unfinished or simplified, grouped by the slice that
introduced them, per the "be pragmatic, don't block on infeasible-in-sandbox
items" guidance:

## Slice 6 (offline review)

- **No real-browser QA yet.** The client-side IndexedDB/service-worker/DOM
  path (`src/client/offline/*.ts`, `public/sw.js`'s `sync` handler) was
  verified only by code inspection — no Playwright/Puppeteer/headless
  browser was available in either the build or review environment. Server-
  side logic (ownership, chronological replay, timestamp clamping) *was*
  independently verified, including an adversarial 3-review scrambled-order
  case now in `tests/offlineSync.test.ts`. Needs real browser QA (go
  offline, complete a review, reconnect, confirm sync) before shipping to
  users.
- **`syncOfflineReviews` isn't idempotent against a lost response.** If the
  server applies a batch but the 2xx response is lost in transit (timeout,
  tab closed mid-response), the client retries and resubmits already-applied
  reviews, double-applying an SM-2/FSRS update. Low-probability window, no
  idempotency key exists to detect a re-send. Follow-up: an idempotency key
  per queued review, checked before replay.

## Slice 5 (FSRS)

- **No per-user FSRS parameter fitting.** `fsrs.ts` uses the published
  default 17-weight vector for every user; the roadmap's slice-5 note
  originally floated fitting parameters from each user's own review log once
  enough history exists. Deferred — hardcoded defaults are a reasonable v1,
  optimization is a follow-up once there's enough real review data per user
  to fit against.

## Slice 1

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
- **Banning doesn't revoke other active sessions** (slice 4) — `getCurrentUser`
  now rejects a banned user's session on next lookup (fixed post-review), but
  a device with a still-cached response or a very short window between ban
  and next request isn't instantly cut off since there's no server-push
  session invalidation. Acceptable at this scale; revisit if sessions need
  hard real-time revocation.
- **Last-admin-lockout check has a benign race** (slice 4): two concurrent
  ban requests against two different admins could both read "1 other active
  admin" before either commits, banning both. Not addressed with a
  transaction/lock — low likelihood, low severity (an operator can still fix
  it via direct DB access), noted rather than fixed for this slice's scope.
