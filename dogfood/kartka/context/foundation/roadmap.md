# Roadmap — Kartka (epic registry)

Epic: `kartka-mvp`. Goal node: `ac6c8b9b-fa79-4f61-b9be-2b64d6d55eec` (shared
memory store, dogfood #3).

**Outcome:** spaced-repetition flashcard PWA. Students build cards by hand or
upload text/attachments for LLM-assisted generation (OpenRouter). SM-2
scheduling, 6 question types, set sharing, i18n (pl/en), admin
moderation+analytics.

**Why sliced:** multi-subsystem (core scheduler, LLM gen, sharing, admin,
i18n/PWA shell) — same failure mode dogfood #1 hit as one giant change.

| # | slice change-id | end-to-end-verifiable outcome | status |
|---|---|---|---|
| 1 | `kartka-core-scaffold` | Hexagonal skeleton (Bun+Astro+htmx+Drizzle, sqlite↔postgres via `DB_DRIVER` env, varlock schema), SM-2 scheduler pure-fn tested, 6 question-type domain models, basic CRUD (create/edit/delete card+set), review flow UI (htmx partials), i18n shell (pl/en), PWA manifest+SW, logo. Green == `bun test` + `bun run build` pass. | **approved** — reviewed (caught+fixed an IDOR blocker, see docs/DOGFOODING.md), 19/19 tests, build ok. Ready to archive. |
| 2 | `kartka-llm-assist` | Upload text/attachment → OpenRouter adapter proposes cards (mapped to the 6 types) for review/accept; every call logged to `llm_call_log` (tokens, estimated cost). | **approved** — reviewed clean first pass (re-verified the slice-1 IDOR class deliberately), 40/40 tests, build ok. Ready to archive. |
| 3 | `kartka-sharing` | Set visibility (private/unlisted/public), share-by-slug, clone-on-import. | **approved** — reviewed clean (thorough access-matrix test coverage), 55/55 tests, build ok. Ready to archive. |
| 4 | `kartka-admin` | Admin panel: paginated+sortable user/set/card lists, moderate (hide/delete content, ban user), simple analytics dashboard (active users, review volume, LLM cost totals) sourced from `llm_call_log` + review events. | **approved** — reviewed, one should-fix (banned user's live session wasn't invalidated on next lookup) fixed. 72/72 tests, build ok. Ready to archive. |
| 5 | `kartka-fsrs` | FSRS scheduler as an opt-in `SchedulerPort` implementation alongside SM-2 (per-user choice, stored on User); parameters fit from that user's own review log once enough history exists, else FSRS defaults. Existing per-card `ReviewState` migrates losslessly (FSRS can bootstrap from SM-2 easiness/interval/repetitions). | **approved** — reviewed (faithful FSRS v4.5 port, verified against the public algorithm), one docs-only should-fix closed. 96/96 tests, build ok. Per-user parameter fitting deferred to a future slice (docs/TODO.md). Ready to archive. |
| 6 | `kartka-offline` | Service worker caches due cards + set content for offline review; review submissions queue in IndexedDB and sync (SM-2/FSRS state resolved server-side) on reconnect, last-write-wins per (card,user) with a visible "synced" indicator. | pending |
| 7 | `kartka-rich-content` | Card bodies (front/back/cloze/prompt/statement text fields) support Markdown + KaTeX math + syntax-highlighted code blocks, sanitized server-side before storage and again at render. | pending |
| 8 | `kartka-cram-mode` | Per-set optional exam date; review-load planner front-loads/compresses intervals to peak the day before and surfaces what it had to deprioritize. Explicit opt-in per set, never changes the default long-term SM-2/FSRS behavior. | pending |
| 9 | `kartka-reminders` | Web Push notifications when cards are due, student-configurable quiet hours; VAPID keys + subscription storage, PWA service worker push handler. | pending |
| 10 | `kartka-a11y-reading` | Per-user reading profile: OpenDyslexic font toggle, adjustable text size/line-spacing/contrast presets, honored across review + card lists (builds on the existing `prefers-reduced-motion` handling from slice 1). | pending |
| 11 | `kartka-live-quiz` | Kahoot-style live round: host starts a timed session from a set (multiple_choice/true_false/type_answer cards only — the auto-scorable types), players join via a short code/link, answer within a countdown, live leaderboard updates in real time. See "Live quiz architecture" below. Core transport + room lifecycle slice — everything below builds on it. | pending — architecture drafted, not yet scoped into a plan |
| 12 | `kartka-live-teams` | Host groups joined players into teams; scoring aggregates per team as well as per player; team leaderboard alongside the individual one. | pending |
| 13 | `kartka-live-host-screen` | Dedicated big-screen host view (separate route/surface from the player's phone view): QR-code + PIN join screen, "waiting for answers" live bar, answer-reveal animation, end-of-round podium screen — the fluffy-animation language from slice 1 extended to a shared-screen moment. | pending |
| 14 | `kartka-live-streaks-hints` | Streak bonus and a light hint mechanic (costs points, reveals a mnemonic/related-fact rather than the answer). Kept learning-honest by design: a streak only pays out its bonus if that same card is *also* answered correctly on its next regular SM-2/FSRS review — reduces reward for speed-guessing without the game feel disappearing. | pending |
| 15 | `kartka-live-post-game-review` | Every question a player missed or answered slowly in a live round is scheduled straight into that player's personal review queue (reduced initial interval, tagged `source: live-quiz`) right after the round ends. **This is the slice that makes "full Kahoot mode" a learning feature rather than a detour** — the game always feeds back into spaced repetition. | pending |
| 16 | `kartka-live-teacher-insights` | Teacher/host view aggregating weak-question data across one round or a class's full live-quiz history (anonymized per-student), so a teacher can re-teach the actual gap. Reuses the Set/Card model; introduces a minimal `teacher`/`class roster` concept if slice 4's role model doesn't already cover it. | pending |
| 17 | `kartka-live-homework-mode` | Asynchronous variant of the same room concept: teacher assigns a live-quiz set as homework with a deadline instead of a live moment; students play it whenever, leaderboard settles at the deadline. Reuses slices 11–13's room/scoring/host-screen machinery in a non-realtime mode — useful for classes that can't sync a live moment. | pending |

Verification substrate: `bun test` (unit) + `bun run build` (Astro build) on
every slice. No Docker/Postgres-server dependency on the critical path — the
default dev driver is sqlite; postgres is proven by the same Drizzle schema
compiling against both dialects, not by standing up a live postgres in CI.

## Slice 5 note — FSRS

Two `SchedulerPort` implementations coexist (`sm2Scheduler`, `fsrsScheduler`);
`User.schedulerPreference` picks one. This is additive, not a replacement —
existing dogfood #3 decision (SM-2 as slice-1's scheduler) stands; FSRS is an
upgrade path, not a retraction.

## Live quiz architecture (slice 11)

The honest tension: htmx+SSR is request/response, live multiplayer needs a
push channel. Two ways to reconcile without abandoning the stack:

1. **htmx's own `ws` extension** — htmx supports a native WebSocket extension
   (`hx-ws`) that keeps the client fully declarative (server pushes HTML
   fragment swaps over the socket, same mental model as every other htmx
   interaction in this app already). No React/Vue creeps in for this one
   feature.
2. **Where the socket terminates** — check first whether
   `@wyattjoh/astro-bun-adapter` can upgrade a request to a WebSocket inside
   an Astro route; if not (likely, SSR adapters are typically request/response
   only), run a small sidecar `Bun.serve()` process (`live-server.ts`) that
   owns only the WebSocket upgrade + room state, shares the session-cookie
   auth (same `SESSION_SECRET`, verifies the same signed cookie) and reads
   Set/Card data through the same Drizzle `db` client. Reverse-proxied under
   `/live/*` in front so it looks like one app to the browser.
3. **Hexagonal boundary holds**: `core/usecases/liveQuizUsecases.ts`
   (createLiveSession, joinSession, submitLiveAnswer, computeScoreboard) is
   pure and testable without a socket in sight; a `LiveSessionPort` interface
   is implemented once by an in-memory `Map<roomId, RoomState>` adapter
   (single-instance MVP — documented limitation, not a blocker) and later
   swappable for a `Bun.redis` pub/sub adapter if the app ever needs
   multi-instance scale-out.
4. **Scope cut that keeps this sane**: only the 3 already-auto-scored
   question types (multiple_choice, true_false, type_answer) play in live
   mode — cloze/basic/image_occlusion stay self-rated/async, they don't fit
   a timed-round format anyway. No persistent "live quiz" identity beyond a
   short-lived room code; it's a practice/fun mode, not a second scheduling
   system — it does not write to SM-2/FSRS `ReviewState`, at most logs an
   "exposure" event a student can later convert into real review cards.
5. **Update — going full-Kahoot-mode (slices 12–17), by explicit human
   call overriding Opus's "argue against."** The condition attached: every
   addition must still serve learning inside the app, not just engagement
   for its own sake. That's why slice 15 (post-game auto-scheduling into
   the real review queue) and slice 14's honesty-checked streak bonus exist
   — they're the mechanism that keeps teams/leaderboards/host-screen
   spectacle (12, 13, 16, 17) pointed at retention instead of becoming a
   detached minigame. The original architectural containment still holds
   for all of it: htmx's extension model + one isolated WebSocket-sidecar
   adapter, no custom protocol, no rearchitecting the rest of the app.

## Token cost estimate (slices 2–17)

Rough order-of-magnitude, anchored to slice 1's *measured* actuals: the
implementer agent spent 224k tokens (200 tool calls) and the independent
review agent spent 91k tokens (43 tool calls) — **~315k tokens for one
bootstrap-sized slice with a review pass.** Later slices are additive
(existing scaffold, ports, DI, i18n, design system already in place), so
most should cost less than slice 1; the ones introducing a genuinely new
subsystem (offline sync, the live-quiz transport layer) are the exceptions
and estimated closer to slice-1 scale. These are planning estimates, not
measurements — actual cost depends on how many review round-trips each
slice needs (slice 1 needed one fix round; some may need more).

| slice | build (implementer) | review | slice total |
|---|---|---|---|
| 2 `kartka-llm-assist` | ~150k | ~60k | ~210k |
| 3 `kartka-sharing` | ~100k | ~50k | ~150k |
| 4 `kartka-admin` | ~150k | ~60k | ~210k |
| 5 `kartka-fsrs` | ~100k | ~50k | ~150k |
| 6 `kartka-offline` | ~200k | ~80k | ~280k |
| 7 `kartka-rich-content` | ~120k | ~50k | ~170k |
| 8 `kartka-cram-mode` | ~90k | ~40k | ~130k |
| 9 `kartka-reminders` | ~130k | ~50k | ~180k |
| 10 `kartka-a11y-reading` | ~80k | ~40k | ~120k |
| 11 `kartka-live-quiz` (new transport subsystem) | ~220k | ~90k | ~310k |
| 12 `kartka-live-teams` | ~90k | ~40k | ~130k |
| 13 `kartka-live-host-screen` | ~150k | ~60k | ~210k |
| 14 `kartka-live-streaks-hints` | ~110k | ~50k | ~160k |
| 15 `kartka-live-post-game-review` | ~90k | ~40k | ~130k |
| 16 `kartka-live-teacher-insights` | ~150k | ~60k | ~210k |
| 17 `kartka-live-homework-mode` | ~130k | ~50k | ~180k |
| **subtotal, slices 2–17** | | | **~2.93M** |
| slice 1 actual (for reference) | 224k | 91k | 315k |
| **epic total (1–17)** | | | **~3.25M tokens** |

That's ~33 agent calls (17 build + 17 review, slice 1 already spent) not
counting my own orchestration turns (prompt-writing, spec decisions, gate
routing, memory captures) — historically a smaller add-on, maybe +10–15%
on top. Treat the whole-epic figure as a budgeting signal ("this is a
few-million-token build if all 17 slices ship"), not a firm quote — the two
biggest variance sources are review round-trips (each fix-and-re-review
cycle adds another review-agent pass) and whether the offline/live-quiz
subsystems need more exploration than a typical additive slice.
