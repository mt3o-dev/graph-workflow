# TODO / known gaps

Things deliberately left unfinished or simplified, grouped by the slice that
introduced them, per the "be pragmatic, don't block on infeasible-in-sandbox
items" guidance:

## Slice 11 (live quiz core)

- **No multi-client real-browser QA yet.** The actual WebSocket wire
  protocol (join → question → answer → advance → reveal → scoreboard
  broadcast across multiple real concurrent sockets) was verified only at
  the usecase layer (against a fake in-memory port, no sockets) plus a
  single-client curl/manual smoke test of the sidecar's HTTP-level
  auth/ownership boundary — no multi-client WebSocket test harness was
  available in build or review. Needs real QA: two+ browser tabs, one host
  one player, full round played end to end. Same disclosed-gap shape as
  slices 6/9's browser-only-verifiable parts.
- **Single-instance only** — the in-memory `LiveSessionPort` doesn't survive
  a sidecar restart and can't scale across multiple processes/machines. A
  `Bun.redis` pub/sub-backed adapter is the documented upgrade path
  (`docs/ADR-live-transport.md`), zero changes needed in `core/domain`/
  `core/usecases` to support it — not built yet.
- **No reverse proxy** — the sidecar is reachable on its own port
  (`LIVE_WS_PORT`); works correctly today (cookies are host-scoped, not
  port-scoped) but a real multi-user deployment should proxy it under one
  origin so end users never see two ports. Follow-up, not a blocker.
- **No room expiry/cleanup** — rooms live for the sidecar process's
  lifetime and are never explicitly deleted from the in-memory Map; a
  restart clears everything. Fine at dogfood scale; a TTL sweep is a small
  follow-up if this matters later.

## Slice 9 (due-card reminders / Web Push)

- **Quiet hours are interpreted in UTC, not the user's own local timezone.**
  `core/domain/reminderPlanner.ts` reads `now.getUTCHours()/getUTCMinutes()`
  and compares against the stored `"HH:MM"` strings as-is. A user who sets
  "22:00-07:00" expecting their own local evening is actually quiet during
  those hours *in UTC* — for anyone not in UTC+0, the real local window is
  offset by their timezone. This is disclosed in the settings page copy
  (`settings.quietHours.hint`, both locales) and in
  `core/domain/reminderPlanner.ts`'s header comment, not silently pretended
  to be correct. Real per-user timezone handling would need a stored IANA
  zone name (e.g. `Europe/Warsaw`) plus a timezone-database dependency
  (`Intl.DateTimeFormat` with a `timeZone` option can do the offset math
  without an extra package, but per-user DST transitions still need care) —
  out of scope for this slice.
- **No real-browser QA of the push path**, same disclosed-limitation shape
  as slice 6's offline review: `Notification.requestPermission()`,
  `pushManager.subscribe()`, actual push delivery, and the service worker's
  `push`/`notificationclick` handlers in `public/sw.js` cannot be
  meaningfully exercised by `bun test` — there's no headless browser with
  real push-service connectivity in this environment. What *is* covered by
  `bun test`: the pure quiet-hours selection logic
  (`tests/reminderPlanner.test.ts`), subscription ownership
  (`tests/reminderUsecases.test.ts`), and the expired-subscription (410)
  cleanup path (same file, with a fake `WebPushPort`). Needs real-browser QA
  (grant notification permission, subscribe, trigger `scripts/send-reminders.ts`
  against a real push service, confirm the notification shows and
  `notificationclick` opens/focuses `/review`) before shipping to users.
- **No in-process scheduler** — by design, not an oversight. This app is
  request/response SSR with nothing long-running; `scripts/send-reminders.ts`
  must be invoked periodically by an external cron (see `docs/RUNNING.md`).
  If that cron isn't set up, no reminders are ever sent — there's no
  fallback or self-check that notices a misconfigured/missing cron job.
- **`sendDueReminders` re-derives every subscribed user's due-card count on
  every run** via the same `startReviewSession` usecase `/review` uses —
  correct (single source of truth for "what counts as due"), but means cron
  frequency directly multiplies read load against `cardRepo`/scheduler
  tables. Fine at this app's scale; would need caching or a coarser signal
  (e.g. a materialized "has due cards" flag) if the user base or cron
  frequency grew significantly.

## Slice 7 (rich content)

- **Offline-reviewed cards render as plain escaped text, not rich
  Markdown/KaTeX/code.** `src/client/offline/render.ts` (slice 6) imports
  from `reviewFragments.ts`, which deliberately has zero import of
  `richContent.ts`/marked/katex/shiki — pulling those in would bundle
  Shiki's full per-language grammar set (megabytes) into the browser.
  Disclosed limitation, not a silent regression: a student reviewing offline
  sees their card's raw markdown source with entities escaped, not rendered
  formatting. Revisit if a lighter client-side renderer becomes worth the
  bundle cost.
- **Markdown images render (`<img>` is allowlisted, src/alt/title/width/
  height only, http/https schemes)** — added post-review after slice 7's
  first pass shipped with `img` entirely un-allowlisted (dead CSS, silently
  broken feature, no XSS risk either way since it just rendered nothing).
- No live-preview-as-you-type; a single "Preview" button re-renders the
  whole form on demand instead of a split-pane editor — matches this app's
  existing no-gimmicks design level.
- h1/h2 excluded from the render allowlist (h3–h6 allowed) — those belong to
  page chrome (set/page titles), not card body text.
- KaTeX fonts vendored as woff2 only (not woff/ttf) to keep the vendor
  bundle small (332K vs ~1.2M) — fine for all current-generation browsers.

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
- **Hint scope substitution (slice 14)**: the roadmap's literal wording for
  the hint mechanic ("reveals a mnemonic/related-fact") assumes authored
  mnemonic content that doesn't exist on any card type in this app. Rather
  than inventing a new card-authoring field this slice doesn't otherwise
  need, a hint is a type-appropriate partial reveal instead: `type_answer`
  gets first-letter + length, `multiple_choice` gets one wrong option
  eliminated, `true_false` has no hint (no meaningful partial reveal exists
  for a binary question) — see `core/domain/liveQuiz.ts`'s "Hints" section.
  Revisit if/when cards gain an authored mnemonic/hint field of their own.
- **Streak-bonus score can go negative via hints (slice 14)**: `requestHint`
  deducts `HINT_COST` from the player's in-round score with no floor at 0 —
  consistent with `scoreAnswer`'s existing "just add/subtract points" model
  and harmless for an ungraded practice round, but worth a floor if a future
  slice ever surfaces raw in-round score somewhere a negative number would
  read badly (e.g. a public leaderboard export).
- **`live_streak_bonuses` rows accumulate forever (slice 14)** — same
  "documented MVP limitation, not a blocker" pattern as the in-memory
  `LiveSessionPort` rooms (see `docs/ADR-live-transport.md`): resolved
  (confirmed/forfeited) rows are never pruned. Fine at this scale; a
  retention sweep would be a small addition if the table grows large.
