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
| 6 | `kartka-offline` | Service worker caches due cards + set content for offline review; review submissions queue in IndexedDB and sync (SM-2/FSRS state resolved server-side) on reconnect, chronological replay per card (not last-write-wins — SM-2/FSRS state is sequential) with a visible "synced" indicator. | **approved** — reviewed, one real should-fix (SW precache of an auth-redirecting route broke the whole app-shell cache for logged-out visitors) fixed. 104/104 tests, build ok. Real-browser QA of the client-side path still outstanding (docs/TODO.md) — no headless browser available in this environment. Ready to archive with that gap disclosed. |
| 7 | `kartka-rich-content` | Card bodies (front/back/cloze/prompt/statement text fields) support Markdown + KaTeX math + syntax-highlighted code blocks, sanitized server-side before storage and again at render. | **approved** — highest-stakes review so far (XSS on user content viewable via slice 3's public sharing); two-layer defense-in-depth held against every payload class tried, 2 should-fix items closed (img was dead/un-allowlisted; missing docs/TODO.md entry). 142/142 tests, build ok. Ready to archive. |
| 8 | `kartka-cram-mode` | Per-set optional exam date; review-load planner front-loads/compresses intervals to peak the day before and surfaces what it had to deprioritize. Explicit opt-in per set, never changes the default long-term SM-2/FSRS behavior — cram sessions only change card *selection*, every review still goes through the real submitReview path. | **approved** — the critical scheduler-state safety constraint independently verified (only reviewUsecases.submitReview ever writes review state); one should-fix (a timezone bug rejected "today" as a past date on servers west of UTC) fixed. 160/160 tests, build ok. Ready to archive. |
| 9 | `kartka-reminders` | Web Push notifications when cards are due, student-configurable quiet hours; VAPID keys + subscription storage, PWA service worker push handler. | **approved** — reviewed clean (adversarial ownership test explicitly constructed, midnight-wrap quiet hours deliberately tested). 183/183 tests, build ok. No in-process scheduler by design — `scripts/send-reminders.ts` needs external cron. Real-browser push QA outstanding (docs/TODO.md). Ready to archive. |
| 10 | `kartka-a11y-reading` | Per-user reading profile: OpenDyslexic font toggle, adjustable text size/line-spacing/contrast presets, honored across review + card lists (builds on the existing `prefers-reduced-motion` handling from slice 1). | **approved** — reviewed clean, zero code changes needed (one design note on a global border-width tweak, flagged for product sign-off not a defect). 190/190 tests, build ok. Ready to archive. |
| 11 | `kartka-live-quiz` | Kahoot-style live round: host starts a timed session from a set (multiple_choice/true_false/type_answer cards only — the auto-scorable types), players join via a short code/link, answer within a countdown, live leaderboard updates in real time. See "Live quiz architecture" below. Core transport + room lifecycle slice — everything below builds on it. | **approved** — hardest slice yet; review found+fixed a real BLOCKER (a pre-existing migration bug since slice 3, only exposed by this slice's second-process topology — see `docs/ADR-live-transport.md`). Everything slice-11-specific (auth, ownership, answer integrity, scoring, hexagonal boundary) reviewed clean. 233/233 tests, build ok. Multi-client WS QA still outstanding (docs/TODO.md). Ready to archive. |
| 12 | `kartka-live-teams` | Host groups joined players into teams (auto-split + manual per-player override); scoring aggregates per team (sum) as well as per player; team leaderboard alongside the individual one. | **approved** — review found+fixed a real blocker (manual override was built but never wired to the WS handler/UI, dead code) and a flaky test (room-code uniqueness). 247/247 tests stable, build ok. Ready to archive. |
| 13 | `kartka-live-host-screen` | Dedicated big-screen host view (separate route/surface from the player's phone view): QR-code + PIN join screen, "waiting for answers" live bar, answer-reveal animation, end-of-round podium screen — the fluffy-animation language from slice 1 extended to a shared-screen moment. | **approved** — double-gated host-only access verified both SSR and WS-upgrade sides; one should-fix (QR rect-merge logic wasn't cross-checked against the real matrix in the permanent test suite) fixed. 263/263 tests, build ok. Ready to archive. **Closes out the entire currently-planned roadmap (1-13).** |
| 14 | `kartka-live-streaks-hints` | Streak bonus (3-in-a-row, 250pts) and a per-player hint mechanic (200pts, type-appropriate partial reveal — first-letter+length for type_answer, eliminate-one-wrong-option for multiple_choice, unavailable for true_false — substituted for the roadmap's "mnemonic" since no authored-mnemonic field exists on cards). Kept learning-honest by design: a streak bonus is only *confirmed* (added to a lasting per-user total) if that same card is also answered correctly on its next real SM-2/FSRS review, forfeited otherwise — implemented as a side effect appended after `submitReview`'s existing scheduling write, never altering it. | **approved** — reviewed clean, zero findings, including explicit regression verification that `submitReview` (the most load-bearing function in the app) is provably unchanged. 288/288 tests, build ok. Ready to archive. |
| 15 | `kartka-live-post-game-review` | Every question a player missed or answered slowly in a live round is scheduled straight into that player's personal review queue (reduced initial interval, real `sourceCardId` FK provenance rather than a plain tag) right after the round ends. **This is the slice that makes "full Kahoot mode" a learning feature rather than a detour** — the game always feeds back into spaced repetition. | **approved** — review found a concurrent-render race that, on investigation, turned out to have a second deeper instance one level up (duplicate practice-set creation); both fixed with DB-level partial unique indexes plus graceful conflict handling, closed with a genuine concurrency regression test. `submitReview` itself untouched; its scheduler-write safety-constraint whitelist was soundly expanded to include this slice's seed-only writer. 302/302 tests, build ok. Ready to archive. |
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

## Token cost: estimated vs. actual (slices 1–13 built; 14–17 projected)

Slices 1–13 are done — this table replaces the original pre-build estimates
with measured `subagent_tokens` from every build + review agent call
(fix-round work I did inline as the orchestrator, e.g. the timezone/IDOR/
migration fixes, is NOT counted here — it's a smaller add-on on top, done at
the main-loop model, not a subagent call).

| slice | estimated | actual (build+review) | ratio |
|---|---|---|---|
| 1 `kartka-core-scaffold` | 315k (reference) | 315,177 (224,408 + 90,769) | 1.00 |
| 2 `kartka-llm-assist` | 210k | 247,299 (171,787 + 75,512) | 1.18 |
| 3 `kartka-sharing` | 150k | 244,369 (167,364 + 77,005) | 1.63 |
| 4 `kartka-admin` | 210k | 307,229 (219,301 + 87,928) | 1.46 |
| 5 `kartka-fsrs` | 150k | 283,085 (213,708 + 69,377) | 1.89 |
| 6 `kartka-offline` | 280k | 240,620 (146,396 + 94,224) | 0.86 |
| 7 `kartka-rich-content` | 170k | 332,783 (226,685 + 106,098; excl. one failed retry attempt) | 1.96 |
| 8 `kartka-cram-mode` | 130k | 286,690 (198,443 + 88,247) | 2.21 |
| 9 `kartka-reminders` | 180k | 292,260 (214,602 + 77,658) | 1.62 |
| 10 `kartka-a11y-reading` | 120k | 237,741 (176,850 + 60,891) | 1.98 |
| 11 `kartka-live-quiz` | 310k | 362,661 (205,386 + 157,275) | 1.17 |
| 12 `kartka-live-teams` | 130k | 218,475 (135,214 + 83,261) | 1.68 |
| 13 `kartka-live-host-screen` | 210k | 277,362 (192,609 + 84,753) | 1.32 |
| **total, slices 1–13** | **2.57M** | **3,645,751** | **1.42×** |

**Average actual/estimate ratio (slices 2–13, excluding the slice-1
reference point): 1.58×, range 0.86×–2.21×.** The original estimates were
anchored only to slice 1's cost and a rough "additive slices cost less"
intuition; in practice every slice after the first came with the same
depth of adversarial review, dual-locale i18n, ADR/TODO documentation, and
(from slice 4 onward) a fix round when review found something — none of
which the original per-slice guesses priced in. The one slice that came in
*under* estimate (`kartka-offline`, 0.86×) was also the one slice whose
implementer had the most pre-existing infrastructure to reuse (slice 1's
PWA shell, existing review UI). The two worst-case slices (`cram-mode` 2.21×,
`a11y-reading` 1.98×) were both nominally "S-effort, small" in the original
sizing — small slices got under-estimated the most in relative terms,
because a fixed documentation/testing/review overhead is a bigger fraction
of a small slice's total cost than a large one's.

## Projected cost, slices 14–17 (not yet built)

Original rough estimates (130k–210k each, 680k subtotal) scaled by the
observed 1.58× average ratio, with a low/high band from the observed
0.86×–2.21× range rather than a false-precision single number:

| slice | original estimate | low (×0.86) | mid (×1.58) | high (×2.21) |
|---|---|---|---|---|
| 14 `kartka-live-streaks-hints` | 160k | 138k | 253k | 354k |
| 15 `kartka-live-post-game-review` | 130k | 112k | 205k | 287k |
| 16 `kartka-live-teacher-insights` | 210k | 181k | 332k | 464k |
| 17 `kartka-live-homework-mode` | 180k | 155k | 284k | 398k |
| **subtotal, slices 14–17** | **680k** | **~585k** | **~1.07M** | **~1.50M** |

Slice 16 carries the most risk of running toward the high end — it's the
one remaining slice that adds genuinely new data model surface (a
teacher/roster concept beyond the existing student/admin roles), the same
shape of complexity that pushed slice 4 (admin, also a new-role-adjacent
surface) to 1.46× and slice 11 (new subsystem) to 1.17× — new-subsystem
slices have historically run closer to their estimate than small
"just settings/UI" slices have, somewhat counterintuitively.

**Revised full-epic projection (1–17), mid case:** 3,645,751 (actual,
1–13) + ~1.07M (projected, 14–17) ≈ **4.7M tokens** — about 45% above the
original 3.25M whole-epic guess made before any slice shipped. Treat this
as the current budgeting signal for the remaining work, not a firm quote —
the two biggest variance sources are still review round-trips (each
fix-and-re-review
cycle adds another review-agent pass) and whether the offline/live-quiz
subsystems need more exploration than a typical additive slice.
