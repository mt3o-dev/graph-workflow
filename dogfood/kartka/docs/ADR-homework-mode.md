# ADR: Homework mode is plain SSR + a new DB table, NOT the live-quiz sidecar (slice 17)

**Decision**: async homework mode is built as **ordinary Astro SSR pages + htmx
form POSTs against three new real database tables** (`live_homework_assignments`,
`live_homework_attempts`, `live_homework_answers`). It does **not** use the
WebSocket sidecar (`live-server.ts`), does **not** touch the in-memory
`RoomState`/`LiveSessionPort` abstraction, and does **not** reuse the
`hx-ext=ws` transport. It **does** reuse the *pure* domain logic from
`core/domain/liveQuiz.ts` — `isLiveEligibleType`, `isAnswerCorrect`,
`toPublicQuestion`, and `generateRoomCode` — directly, because those are plain
functions with no dependency on sockets or `RoomState`.

## Why not reuse the live-quiz room machinery

The roadmap frames homework as "the same room concept, async." The
*conceptual* overlap is real (a host's set, a join code, per-question
correctness, a leaderboard), but the *persistence and delivery* requirements
are fundamentally different, and that difference is exactly what
`RoomState`/`LiveSessionPort` was built to NOT handle:

- **Lifetime.** A live round lasts minutes; the sidecar process is expected to
  stay up for its duration, which is why slices 11-13 explicitly documented the
  in-memory `Map` as acceptable (`docs/ADR-live-transport.md`, "Room
  expiry/cleanup" and "Multi-instance scale-out" — a restart clears
  everything). A homework assignment must survive for **days**, across sidecar
  restarts, until its deadline. Forcing it into `LiveSessionPort` would
  inherit a persistence model (`RoomState` in a process-local `Map`) that
  cannot survive what this feature needs — the assignment would vanish on the
  first restart.
- **No synchronized moment.** `RoomState` is a phase machine
  (`lobby → question-live ⇄ reveal → finished`) driven by a host advancing
  everyone through the same question at the same time, with a
  `questionStartedAtMs` the whole room shares. Homework has **no synchronized
  countdown and no live-updating opponent view** — each student answers on
  their own schedule, like an ordinary self-paced quiz. There is no phase to
  broadcast, no "advance" for a host to press, nothing real-time to watch. A
  WebSocket would carry no message that a normal request/response couldn't.
- **Shape mismatch.** `advancePhase`, `answeredCount`, the host big-screen
  reveal fragments, `question-live`/`reveal` broadcasts — none of it maps onto
  "a row per student, filled in over days." Building homework on that
  abstraction would mean fighting it at every step.

Plain SSR here is **simpler, not a compromise**: a durable DB table is the
correct home for multi-day state, `getOwnedSet` is the correct owner gate, and
Post/Redirect/Get form submissions are the app's existing no-client-JS idiom
(slices 1-10). The WebSocket sidecar's one genuine justification — upgrading a
connection Astro's route contract can't (`docs/ADR-live-transport.md`) — does
not apply to anything homework mode does.

## What IS reused (the pure core)

`core/domain/liveHomework.ts` imports `isAnswerCorrect`, `isLiveEligibleType`,
and `toPublicQuestion` from `core/domain/liveQuiz.ts` and uses them unchanged.
Correctness scoring is therefore *identical* to live mode; only the transport
and persistence differ. The join code reuses `generateRoomCode`
(+`isValidRoomCode`) — same 5-char, visually-unambiguous, not-a-security-
boundary shape as a live room code.

## Deliberate scope decisions (documented, not oversights)

- **No speed bonus.** Homework reuses `isAnswerCorrect` but deliberately NOT
  `scoreAnswer`'s speed-bonus math. A speed bonus is only *fair* when every
  player faces the same synchronized timer (live mode's `questionStartedAtMs`).
  Homework players answer at arbitrarily different real times, so a speed bonus
  would have no fair meaning. Homework score is **base correctness only** — one
  point per correct answer (`HOMEWORK_POINTS_PER_CORRECT`).
- **Individual leaderboard only — team mode is cut.** Per the roadmap's slice
  17 scope. Team mode (slice 12) is a live-lobby setup step (`configureTeams`
  rejects any call once the room leaves `lobby`); it has no lobby to configure
  in an async assignment. Left out on purpose.
- **No host big-screen / live-updating view.** Slice 13's host screen is a
  projector experience for a synchronized live moment. Homework has no live
  moment to watch, so the host status page is a normal SSR page: a reload shows
  current data. Forcing the big-screen WebSocket UI onto it would be building a
  live experience for something with nothing live in it.

## Deadline handling (reuses slice 8's timezone fix)

The deadline is chosen with a date input (`YYYY-MM-DD`). Validation reuses
slice 8's exact fix (`setUsecases.setExamDate`): the `new Date("YYYY-MM-DD")`
value parses as **UTC midnight** (ECMA-262), and "today or later" is checked by
comparing **UTC calendar-date strings** on both sides — never a server-*local*
midnight, the bug slice 8's review caught, which rejected a same-day deadline
for anyone in a timezone west of UTC. The stored deadline is then the **end of
that UTC day** (`23:59:59.999Z`, `homeworkDeadlineInstant`), giving deadline
enforcement a precise, timezone-unambiguous cutoff. Verified in
`tests/liveHomework.test.ts` with a `now` that has a real (non-midnight) clock
time, the same way slice 8's fix was verified.

## Concurrency (applied from the start, per slices 15/16)

Three DB-level guards, not in-process locks, close the double-write races
slices 15/16's reviews had to find after the fact:

- **One attempt per (assignment, user)** — unique index; two concurrent first
  plays race, the loser catches the violation and re-reads the winner
  (`ensureAttempt`), exactly like slice 15's `findOrCreatePracticeSet`.
- **One answer per (attempt, card)** — unique index + `onConflictDoNothing`;
  a double form-submit / retry / two concurrent tabs on the same question
  produce one recorded answer and one score, never two.
- **Completion is a one-way idempotent transition** — `UPDATE ... WHERE
  completed_at IS NULL`; two tabs finishing the last question at once resolve
  to a single completion.

Proven with genuine `Promise.all` concurrency tests in
`tests/liveHomeworkUsecases.test.ts`, matching the shape slices 15/16 added.

## In-progress attempt when the deadline passes

Scored **as-is** (whatever was answered), not excluded. The leaderboard and
host status recompute each attempt's score from the source-of-truth answer
records, so an attempt still `in_progress` when the deadline passes ranks by
what it answered, and always sorts after every completed attempt at the same
score (`homeworkLeaderboard`'s null-completedAt-last tiebreak).
