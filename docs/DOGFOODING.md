# Dogfooding report — building real apps with the graph-workflow

Two greenfield builds exercised the workflow end-to-end:

- **Dogfood #1 — Interview Copilot** (`dogfood/interview-copilot/`): a Tauri 2 +
  Svelte 5 realtime interview-RAG app, built as a single (over-large) change.
  Section below.
- **Dogfood #2 — Coffer** (`dogfood/coffer/`): a self-hosted, BG-themed
  bank-history analytics app, built at **epic scale** to exercise the epic layer
  that dogfood #1 motivated. See "Dogfood #2" at the end.

---

# Dogfood #1 — Interview Copilot

2026-07-18. The workflow was exercised end-to-end on a real greenfield build:
**Interview Copilot** (`dogfood/interview-copilot/`), a Tauri 2 + Svelte 5
realtime interview-RAG app. Opus planned; Sonnet agents implemented; the gw
gates ran as fresh-session subagents. This document records what happened, what
the workflow caught, what it lacked, and what was fixed as a result.

## What was built

Hexagonal TS core (VAD turn detection → question classification → context
window → cosine retrieval → grounded answering) behind 8 ports; adapters:
WhisperLive-WS + OpenAI Realtime STT, transformers.js + OpenAI embeddings
(shared 384-dim index geometry), sqlite-vec index, better-sqlite3 session log,
Anthropic Haiku answering, markdown KB, layered config (defaults < env < user
file < `IC_*` vars); DI composition root; 100-question categorized KB
(frontend/backend/theory/behavioral × 25, validated by a schema gate); design
system (tokens, light/dark, 14 components) + four screens; Tauri 2 shell;
WebdriverIO + tauri-driver e2e scaffold.

Final state: **typecheck 0 errors / 495 files, 156 tests passing (4
network-gated skips), 100 KB docs validating, web + Tauri-static builds green.**
Rust compile, live audio, and e2e execution are deferred to a Rust/GPU machine
(`docs/deferred-verification.md` in the app).

## Lifecycle trail

| Gate | Agent | Outcome |
|---|---|---|
| foundation | main session | PRD + 12-decision tech-stack record |
| gw-new | main session | change `copilot-mvp`, degraded-mode scope (see below) |
| gw-plan | **Opus** | 7 phases, pnpm-only verification per phase |
| gw-plan-review | Sonnet (fresh) | **Request changes** — caught 2 real findings |
| gw-implement | 6 Sonnet agents | phases 1–4, 5, 6 (+4 KB content agents) |
| gw-review | Sonnet (fresh) | **Approve** — 2 minor findings, re-verified green itself |
| gw-archive | main session | folder archived; sweep deferred (no store) |

## What the workflow caught (evidence it works)

1. **gw-plan-review caught a constraint violation before any code existed.**
   The KB frontmatter schema in the plan silently collapsed `difficulty` and
   `expertise` — a drift introduced by a foundation edit racing the planner.
   Cost of catching it at the plan gate: one plan edit. Cost at review: rework
   across 100 KB files.
2. **gw-review caught undisclosed drift** (`/knowledge`,`/sessions` vs planned
   `/kb`,`/log`) and independently re-ran all verification rather than
   trusting the implementers' claims. Both reviews were fresh sessions whose
   only context channel was the recalled constraint set — the design premise
   held up in practice.
3. **The gates consumed the degraded-mode backlog as a stand-in graph** and
   still functioned. Discipline survives the store being down.

## Flaws found → fixed (issues #17–#20)

1. **"Captures are lost, not queued" was wrong guidance** (#17). Queueing works:
   every would-be memory operation went to `memory-backlog.md` and is fully
   replayable. Fixed: degraded mode now *requires* the backlog (standing rule,
   USAGE en/pl, gw-init, gw-archive deferred-sweep protocol).
2. **Foundation amendment concurrency** (#18). tech-stack.md was clarified while
   Opus was mid-plan; the stale schema shipped in the plan and only the gate
   caught it. Fixed: amendments happen between gates or are announced in active
   changes; gates re-read foundation independently as the designed net.
3. **No epic layer** (#19). `copilot-mvp` was an epic wearing one change-id — 7
   phases, 6 agents, multiple review sittings. Fixed: `roadmap.md` is the epic
   registry; slices carry `epic:` in change.md, the epic id as a capture facet,
   sibling surviving nodes as parent_refs; gw-new warns on epic-sized goals;
   gw-archive closes epic entries.
4. **Phase-parallel subagents were unregulated** (#20). Two agents nearly
   collided on build config; an e2e spec assumed a `data-testid` contract the
   UI agent hadn't built (it converged, by prompting and luck). Fixed:
   gw-implement/gw-goal now require disjoint file ownership declared up front,
   cross-phase contracts captured before the consumer starts, per-phase capture
   headings, and orchestrator re-verification of the merged state.

## Observations that are notes, not fixes

- One implementation agent died on a session limit mid-scaffold; resuming it
  with a state delta ("here is what's on disk, continue") worked cleanly — the
  worktree-as-truth model makes agent crashes cheap.
- `rm` being permission-denied for agents left scaffold litter; the review gate
  caught that it was merely disclosed, not resolved. Gitignore was the
  compliant fix.
- The 4 KB content agents and the core agent ran concurrently against disjoint
  paths with zero conflicts — the disjoint-ownership rule in #20 is cheap and
  sufficient in practice.

## Replay debt

The archived change (`context/archive/copilot-mvp/`) carries an unreplayed
`memory-backlog.md`. When agentic-memory is registered for this repo: run
/gw-init + /gw-foundation, replay the backlog (create_change, captures,
events, promotions), then `memory_lifecycle.py deactivate copilot-mvp --sweep`.

---

# Dogfood #2 — Coffer (epic-scale)

2026-07-18. `dogfood/coffer/` — a self-hosted, Baldur's-Gate-themed bank-history
analytics app (import PDF/CSV/OFX, many-group classification, income/outcome
diagrams, multilingual, Docker-deployable). Chosen to stress the parts dogfood
#1 could not: the **epic layer** (#19) and **phase-parallel execution** (#20),
both fixed after #1. Opus planned and drove with minimal oversight; Sonnet
agents implemented.

## How it ran

Foundation (PRD + 14-decision tech-stack) → `roadmap.md` as the **epic
registry**, slicing `coffer-mvp` into 5 vertical slices. Opus opened slice 1
(`coffer-core-import`, `epic: coffer-mvp`), wrote its 7-phase plan and thin
stubs for slices 2–5, and recommended driving slice 1 alone to green. The
plan-review gate approved slice 1 clean (no findings). Implementation ran
phase-parallel: P1 solo (scaffold + boundary-lint), **the orchestrator authored
the three shared port files as fixed contracts** (StorePort, PdfTextPort,
StatementParserPort), then P2/P3 and P4/P5/P6 ran as parallel Sonnet agents on
disjoint paths, P7 integrated. The review gate re-ran all four checks itself and
approved.

**Result:** slice 1 archived, green, reviewed — pure-TS hexagonal import
subsystem (bigint Money, stable content-hash dedup, layered config, sqlite store
+ in-memory fake sharing one contract, unpdf text extraction separated from
CSV/OFX/tabular parsers, pipeline + composition root). 125 tests; the headline
idempotency e2e re-imports 5 real fixtures through real sqlite and asserts zero
new rows. Slices 2–5 left honestly `pending` with plans written — a partial
epic the registry records.

## What the epic layer + phase-parallel fixes bought

- **The epic layer worked as designed.** A feature-rich product that would have
  been another over-large single change (dogfood #1's mistake) decomposed into
  five reviewable slices; slice 1 stayed one plan / one review sitting; the
  registry carries the parent_refs ledger handing slice 1's surviving nodes to
  slice 2. The #19 fix earned its keep on first use.
- **Authoring shared contracts before consumers (the #20 rule) removed the
  collision class.** In #1, two parallel agents raced a data-testid contract and
  "agreed by luck." In #2, the orchestrator wrote the port files first, so
  P4/P5/P6 were pure implementers — zero contract races across three concurrent
  agents.

## New signals this run surfaced

1. **Shared `package.json` is still a live collision point** (new issue #21).
   The #20 rule fences source files by ownership, but P4 and P5 both added deps
   concurrently and produced a **duplicate `dependencies` key** in package.json;
   P4 caught and merged it. Manifest/lockfile edits need the same single-owner
   treatment as source — the orchestrator (or a serialized dep step) should own
   them. Fixed in gw-implement's phase-parallel note.
2. **Inert-leftover litter compounds under phase parallelism** (new issue #22).
   The `_probe.ts` boundary-lint-proof file (rm policy-denied in #1's pattern)
   survived five phases, each *independently re-verifying* it — wasted work the
   review gate flagged. When agents can't delete, a phase's proof artifacts
   should be written under a gitignored scratch path, not into `src/`.

## Cross-cutting confirmation

Degraded mode (no MCP) again held: every phase queued its captures in
`memory-backlog.md`, both gates consumed it as the stand-in graph, and the
archive deferred the sweep with a replay note — now the documented norm, not an
improvisation. Native better-sqlite3 built fine here (arm64), so the store
contract ran for real rather than only against the fake.

## Replay debt

`context/archive/coffer-core-import/memory-backlog.md` is unreplayed. On MCP
registration: /gw-init + /gw-foundation, replay the backlog, promote slice 1's
surviving nodes, wire them as slice 2's parent_refs, then deactivate --sweep.

---

# Dogfood #3 — Kartka (epic scale, slice 1 green)

`dogfood/kartka/` — a spaced-repetition flashcard PWA (Bun + Astro + htmx,
hexagonal, Drizzle sqlite↔postgres via `DB_DRIVER`, varlock env, SM-2
scheduler, 6 question types, LLM-assisted card generation via OpenRouter with
per-call cost logging, set sharing, admin moderation+analytics, i18n pl/en).
Chosen to stress a **shared MCP store across multiple dogfood apps in one
repo** — the first two dogfoods each had their own project; this repo had
never run two epics against one `.mcp.json` registration concurrently.

Roadmap (`dogfood/kartka/context/foundation/roadmap.md`): slice 1
`kartka-core-scaffold` (**green, unreviewed** — see below) → slice 2
`kartka-llm-assist` (pending) → slice 3 `kartka-sharing` (pending) → slice 4
`kartka-admin` (pending).

## Slice 1 result

Hexagonal skeleton, SM-2 scheduler, 6 question types, CRUD + review flow,
i18n (pl/en, no English-only strings left), PWA manifest+SW+icons, admin
seam (role/banned columns + gated `/admin` stub) — all in one implementer
pass (single general-purpose agent, no phase-parallel needed at this size).
`bun test`: 19 pass / 0 fail, 46 assertions (sm2 quality sequences +
easiness floor, Levenshtein fuzzy match, full createSet→addCard→
listCardsInSet pagination + auth-rejection against a real temp
`bun:sqlite` file). `bun run build` green (Astro SSR). Beyond the two
required checks, the agent also ran the built server and drove a full
signup → admin auto-seed → create set → add card → review → SM-2-persist
flow with curl — the vertical slice was proven end-to-end, not just at the
unit level.

**Update — the review gate (#29's own fix) caught a real blocker on first
use.** A second fresh-context agent independently reviewed the slice and
returned **request changes**: a genuine exploitable IDOR — `/api/review/answer`
and `/api/review/rate` scored/persisted review state against a client-supplied
`cardId` with **no ownership check**, while every other card-mutating path
(`editCard`, `deleteCard`, `listCardsInSet`) correctly used a
`getOwnedCard`-style guard. Also flagged: 4 hardcoded English strings outside
the i18n dictionaries, and one hardcoded `aria-label`. Everything else —
hexagonal boundary (verified by grep, not just folder convention), SM-2
correctness against multiple quality sequences, all 6 question types, password
hashing (`Bun.password`), signed httpOnly session cookies, `prefers-reduced-
motion` + focus-visible — reviewed clean. Both findings fixed (exported
`getOwnedCard`, routed both endpoints through it with 403/404; added the
missing i18n keys in `pl.json`/`en.json`, upload-status strings threaded to
client JS via `data-*` attributes since that script runs in-browser). Re-ran
green after the fix: 19/19 tests, build ok. **This is exactly the dogfood
#1/#2 evidence repeating: single-agent slices need the review gate, and
skipping it (as the first pass here did) is where real bugs slip through.**
Slice 1 now approved.

## New signals this run is surfacing (live — update as slices land)

23. **One MCP server registration per repo, shared `MEMORY_DB_PATH`.**
    `.mcp.json` points at `dogfood/coffer/context/memory-graph.db`; a second
    dogfood app can't get its own store without editing `.mcp.json` and
    restarting the MCP connection — not possible from inside a running
    session. Workaround used: same shared store, new `change_id`
    (`kartka-mvp`, `kartka-core-scaffold`) and project-scoped facets to keep
    the two apps' graphs distinguishable by query. Real fix belongs in
    gw-init: either support multiple named MCP servers per project
    (`agentic-memory-<project>`) or document the shared-store-by-facet
    pattern as the norm instead of an improvisation.
24. **gw-init assumes one dogfood app per repo.** Its scaffold step
    (`context/{changes,archive,foundation}`) had to be created by hand under
    `dogfood/kartka/` rather than via the skill, because the skill's "verify
    MCP server" step talks about *the* project store, singular. Needs a
    monorepo-of-dogfoods variant.
25. **A locked tech-stack decision assumed a package that doesn't exist.**
    The spec named `@nurodev/astro-bun-adapter`; it 404s on npm. The
    implementer substituted `@wyattjoh/astro-bun-adapter`, which forced an
    unplanned `astro` downgrade (7.1.5 → 6.4.8) to satisfy its peer range —
    a cascading dependency the orchestrator's tech-stack decision never
    anticipated. Lesson: "locked" package names in a plan/spec are
    unverified claims until `bun add`/`npm view` actually resolves them;
    gw-plan (or whichever gate writes the stack decision) should spot-check
    package existence, not just architecture fit.
26. **varlock's real defaults inverted the spec's assumption.** The spec
    assumed only `@sensitive`-tagged vars are masked; varlock actually
    treats everything sensitive by default (`@defaultSensitive=false` must
    be set explicitly at the schema root), and typed env access requires a
    `varlock codegen` step plus launching via `varlock run --` — none of
    which was knowable without reading the library's own README mid-build.
    Same class of issue as #25: a tool chosen at plan time by
    name/reputation, not by reading its actual current docs.
27. **Postgres-via-Bun has more than one valid driver choice, spec didn't
    pick one.** The spec said "Postgres via env" without naming a driver;
    the implementer chose Drizzle's native `bun-sql` (`Bun.sql`-backed)
    over `pg`/node-postgres to keep the stack Bun-native — a reasonable
    call, but it was left to the implementing agent rather than decided at
    plan time. Worth a standing rule: "runtime-native driver over the
    conventional Node one" should be stated once in tech-stack.md for
    Bun-based dogfoods, not re-decided per slice.
28. **Hand-rolled migrations vs. drizzle-kit wasn't specified.** For a
    from-scratch schema this was a harmless implementer choice
    (idempotent `CREATE TABLE IF NOT EXISTS`), but it's the kind of
    decision that should be a captured `decision` node at plan time, not
    discovered only by reading the implementer's own deviation report —
    otherwise slice 2's implementer might assume drizzle-kit migrations
    exist and collide.
29. **Single-agent slices skip gw-plan-review/gw-review entirely if the
    orchestrator doesn't explicitly route through them.** Slice 1 went
    straight from spec → implementer agent → "done", bypassing the
    fresh-session plan-review and review gates dogfood #1/#2 both credit
    with catching real drift (see their "What the workflow caught"
    sections). Nothing here was necessarily wrong, but the workflow's own
    evidence says single-pass slices are exactly where an unreviewed
    deviation (like #25–#27) is most likely to slip through unchallenged.
    Fix to consider: gw-new/gw-implement should refuse to call a slice
    "done" without at least one independent review pass, regardless of
    slice size.

## Slice 2 result — kartka-llm-assist

OpenRouter-backed `LlmGeneratorPort` adapter proposing cards from pasted
text/`.txt`/`.md` uploads, review/accept before persistence, `llm_call_log`
with real usage-derived tokens + a tested cost formula on both success and
error paths. Reviewed **clean on the first pass** — 40/40 tests, build green,
no findings. The review agent specifically re-checked the exact IDOR class
that broke slice 1 (ownership before any LLM call) and found it correctly
guarded, with a test asserting the port is never invoked for a non-owner.
First evidence that the review-gate discipline (#29) generalizes: once it's
standard practice rather than skipped, a slice can genuinely pass clean.

## Slice 3 result — kartka-sharing

Visibility (private/unlisted/public), a public `/s/{slug}` share page, a
discover/browse page, and clone-on-import. Reviewed **clean on first pass**
again — 55/55 tests, build green. Security-critical surface (the
owner/other-user/anonymous × private/unlisted/public access matrix, slug
unguessability, DB-enforced uniqueness, clone ownership correctness) was
covered by real tests and held up under independent review. Deliberate
design call worth keeping as a pattern: `/s/{slug}` collapses "unknown slug"
and "exists but private" into the same 404, so the route can never confirm a
slug's validity to a prober — noted explicitly by the implementer and
verified consistent by the reviewer. Two slices in a row now reviewed clean;
the review-gate discipline from #29 is holding.

## Slice 4 result — kartka-admin

Admin panel: paginated/sortable user/set/card lists, ban/unban, admin-bypass
delete for sets/cards, analytics dashboard (LLM cost totals real off
`llm_call_log`; active-users/review-volume are documented, UI-visible
proxies off `ReviewState.lastReviewedAt`, no separate event log exists yet).
One **should-fix** from review: `getCurrentUser` didn't check `user.banned`,
so a banned user's still-signed session cookie kept working until its
30-day natural expiry even though `login()` correctly rejected them —
accurately self-documented in a test comment, but not enforced and not
recorded as a known gap. Fixed (`session.ts` now treats a banned user's
session as logged-out). Everything else — server-side role re-checks
independent of page gates, genuine cascade-delete via `ON DELETE CASCADE` +
`PRAGMA foreign_keys=ON` rather than fake-ownership, correct last-admin-
lockout counting, allowlisted sort columns — reviewed clean. 72/72 tests,
build green after the fix.

## Slice 5 result — kartka-fsrs

FSRS as an opt-in second `SchedulerPort` alongside SM-2, per-user preference,
sm2→fsrs bootstrap mapping for mid-use switches. Reviewer independently
checked the FSRS formulas against the published v4.5 algorithm (S0/D0
tables, difficulty mean-reversion, stability update forms, the
retrievability/interval formulas) and found a faithful port, not an
approximation — with tests asserting real algorithmic properties (stability
growth, Again-vs-Good divergence, difficulty bounds) rather than smoke
tests. SM-2 verified byte-identical/untouched via git diff since slice 1.
One should-fix, docs-only: `docs/TODO.md` hadn't recorded the deferred
per-user parameter-fitting gap that was only living in a code comment and
the roadmap note — fixed. 96/96 tests, build green.

## Slice 6 result — kartka-offline

The hardest slice on the roadmap: a service-worker-cached due-card bundle,
client-side scoring reusing the real pure domain functions (not a
reimplementation), an IndexedDB pending-review queue, and a sync endpoint
that replays queued reviews chronologically per card with timestamp
clamping (future-dated clamps down to server time; a rewound/skewed
timestamp clamps up to the card's last known review rather than being
silently accepted or dropped). One real should-fix, and the reviewer
explicitly disagreed with the implementer's own "harmless" framing of it:
`public/sw.js` eagerly precached `/review` at install time, but `/review`
302-redirects to `/login` for a logged-out visitor, and `cache.addAll`
*throws* on a redirected response per spec — since `addAll` is all-or-
nothing, this silently broke the entire app-shell precache (not just
`/review`) for every visitor who hadn't logged in yet, a real regression
vs. pre-slice-6 behavior. Fixed by dropping `/review` from the eager
precache list — it now caches the normal way, opportunistically, the first
time an authenticated visit actually returns a real 200. The reviewer also
constructed their own adversarial 3-review scrambled-order/future-dated
test case to stress the replay/clamp logic beyond what the implementer had
written, confirmed it held (the floor-chaining makes the monotonic-clamp
guarantee structural, not incidental), and that case was folded into the
permanent suite. **New signal (#30):** a review agent left a stray
uncommitted scratch test file behind because `rm` is policy-denied to
agents in this environment — same class as dogfood #2's issue #22
("inert-leftover litter"), recurring here in a *review* agent rather than
an implementer. The established fix (scratch artifacts go to a gitignored
path, never into tracked source) apparently isn't being generalized to
review agents automatically; worth reinforcing in the review-gate
instructions specifically, not just implementer instructions. **Disclosed,
not fixed:** no Playwright/Puppeteer/headless browser was available in
either the build or review environment, so the client-side IndexedDB/
service-worker/DOM path was verified only by code inspection on both
passes — recorded honestly in `docs/TODO.md` as outstanding real-browser QA
rather than claimed as tested. 104/104 tests, build green after the fix.

## Slice 7 result — kartka-rich-content

The highest-stakes review yet: Markdown + KaTeX + syntax-highlighted code in
card bodies, viewable via slice 3's public sharing, so an XSS bug here is a
real cross-user vulnerability, not a self-inflicted one. Two-layer defense-
in-depth (write-time raw-HTML strip, render-time allowlist sanitization)
held against every payload class the reviewer tried through the *actual*
write→store→render pipeline: script tags, `onerror`/`onload` handlers,
`javascript:`/`data:` URIs in both markdown and raw-HTML-in-markdown form,
CSS-injection attempts against the style allowlist (including trying to
bypass the anchored hex-color/length regexes), and KaTeX macro injection
(verified `trust` isn't enabled). The reviewer deliberately skipped layer 1
to confirm layer 2 alone still holds — the defense-in-depth claim wasn't
just asserted, it was tested as designed. Two should-fix items, both closed:
(1) `img` was entirely missing from the render-time allowlist, so markdown
images silently rendered as nothing — dead feature with matching dead CSS,
no XSS either way, just undisclosed brokenness; fixed by allowlisting `img`
narrowly (src/alt/title/width/height, http/https only, no event handlers
ever allowlisted). (2) no `docs/TODO.md` entry existed for this slice's
disclosed gaps despite code comments pointing at "the slice report" —
fixed. Also worth noting: the *implementer* caught and fixed its own
client-bundle-bloat bug mid-build (importing the rich pipeline into the
same module slice 6's offline code bundles into the browser would have
dragged Shiki's multi-megabyte grammar set into every user's phone) —
caught before review, not by review. 142/142 tests, build green, client
bundle re-verified unchanged at 504K after the post-review fix.

## Slice 8 result — kartka-cram-mode

A per-set optional exam date composes special "cram" review sessions
(weighted card selection, deprioritized-card warnings) under a deliberately
strict safety constraint: cram mode must never write review state outside
the existing `submitReview` path — it only changes which cards get
*selected*, never touches stored scheduling data directly. That constraint
held: the reviewer independently re-grepped for any scheduler `.upsert`
outside `reviewUsecases.ts` and found none, confirming the implementer's own
self-verifying static test wasn't just checking itself. One real should-fix
found and fixed: `setExamDate`'s past-date guard compared a UTC-midnight
`examDate` (parsed from an HTML date-input string, which ECMA-262 parses as
UTC) against a *server-local*-midnight `today` — in any server timezone west
of UTC, a student setting today's own exam date was wrongly rejected as "in
the past." Fixed by comparing UTC calendar-date strings on both sides
instead of epoch milliseconds, which removes the mismatched-reference-frame
bug structurally rather than patching around one timezone. This is the
second slice in a row (after #29's fix) where the independent review caught
a real, non-hypothetical bug the implementer's own — otherwise thorough —
test suite didn't cover. 160/160 tests, build green after the fix.

## Slice 9 result — kartka-reminders

Web Push for due cards: VAPID keys, a subscription table, quiet hours
(deliberately UTC-only, disclosed rather than pretended timezone-aware), and
`scripts/send-reminders.ts` as a standalone script for external cron — no
in-process scheduler exists in this SSR app, by design, not an oversight.
Reviewed **clean**, no fixes needed — after two slices in a row (#offline,
#cram-mode) where review caught a real bug, this one held. Notably the
implementer's own tests didn't just happen to pass on the security-critical
paths: `tests/reminderUsecases.test.ts` explicitly constructs an attacker-
guesses-victim's-push-endpoint scenario and asserts it fails, and
`tests/reminderPlanner.test.ts` deliberately tests a midnight-wrapping quiet-
hours window (e.g. `22:00`–`07:00`), not just the easy same-day case. Due-
card counts in the notification payload reuse the exact same
`startReviewSession` usecase `/review` itself calls, so there's no parallel
count query that could silently drift from what a student actually sees.
183/183 tests, build green, zero changes needed post-review.

## Slice 10 result — kartka-a11y-reading

The deliberately small slice: OpenDyslexic toggle, text size/line-spacing/
contrast presets, self-service via the same per-column pattern slice 5
established. Reviewed clean. Two things worth noting even on a "just CSS"
slice: enum validation was genuinely bypass-tested (the usecase called
directly with bogus values cast past the type system, not merely a
`<select>`-option check), and high contrast is a real pure-black/white swap
plus a border-width bump, not a token tweak too subtle to matter. One
design note, not a defect: the border-width change applies globally rather
than scoped to reading surfaces — a deliberate site-wide choice the reviewer
found no actual breakage from, flagged for product sign-off. This is the
6th slice past the base MVP (5 FSRS, 6 offline, 7 rich-content, 8 cram-mode,
9 reminders, 10 a11y) — 190/190 tests, build green, zero code changes
needed post-review. Full-Kahoot arc (slices 11-13) is next.

## Slice 11 result — kartka-live-quiz (new signal #31)

The hardest slice on the roadmap: real-time multiplayer bolted onto an
SSR/htmx app via a second `Bun.serve()` process (a WebSocket sidecar sharing
the main app's sqlite file), with htmx-ext-ws keeping the client
declarative and a hexagonal `LiveSessionPort` (in-memory `Map`, documented
single-instance MVP limit) keeping room logic testable without sockets.
Review found and fixed a real **blocker** — and it's a process-level
finding, not a slice-11-authored code bug:

31. **A dormant migration bug since slice 3, invisible until a second
    process touched an already-migrated database.** `migrateSqlite.ts`'s
    `ALTER TABLE ... ADD COLUMN` "catch duplicate-column, ignore" guards
    checked only `err.message` — but Drizzle's `db.run()` wraps the
    underlying bun:sqlite error in its own `DrizzleQueryError`, whose own
    message is a generic "Failed to run the query" string; the real
    `"duplicate column name"` text lives one level down, on
    `err.cause.message`. Every guard's check was silently dead code since
    slice 3 introduced the pattern. `bun test` never caught it because every
    test file gets a fresh, never-migrated sqlite file and `migrate()` runs
    exactly once per process — the bug requires a *second* process to open
    an *already-migrated* file and migrate again, which nothing in this
    codebase did until slice 11's WebSocket sidecar. The reviewer reproduced
    it live (not just by reading code): booted the sidecar against a
    DB the main app had already migrated, watched its first `getContainer()`
    call throw uncaught, the memoized container promise cache the rejection,
    and every subsequent request — including a trivial existence check —
    500 forever with no recovery short of a full restart. **The general
    lesson: a bug that only manifests on the *second* process/connection to
    touch shared state is exactly the class single-fresh-boot smoke tests
    (and single-process test suites) structurally cannot catch — worth a
    standing question at any future review touching shared persistent
    state: "has anything besides the main process's first boot ever
    exercised this path?"** Fixed centrally (one shared
    `isDuplicateColumnError()` helper checking both message levels),
    verified with a real two-connection reproduction before/after, and
    captured as a permanent regression test.

Everything specific to slice 11's own design — the cross-port cookie-auth
re-verification (checked side-by-side against the main app's version, not
assumed equivalent), host-only "advance" enforced server-side (not just
UI-hidden — a raw WS client sending the message directly is rejected),
room-creation ownership, an answer-integrity state machine that rejects
stale/future-question replay and double-scoring, scoring that reuses the
real domain functions with the correct answer never leaked before reveal,
private card-type exclusion tested against a genuinely mixed-type fixture,
zero `ReviewState`/`FsrsReviewState` writes, and a clean hexagonal boundary
— reviewed clean. 233/233 tests, build green after the fix. Multi-client
real-browser WS QA remains honestly disclosed as outstanding (`docs/TODO.md`)
rather than claimed as tested — same disclosure discipline as slices 6/9.

## Slice 12 result — kartka-live-teams

Team grouping (auto-split + manual override), sum-based team scoring, a
team leaderboard alongside the individual one. Review found and fixed a
real blocker of a different shape than any prior slice: **the manual
per-player team override was fully implemented and correctly host-gated at
the domain and usecase layers, with real passing tests — and was completely
unreachable in the running app.** `live-server.ts`'s WS message handler had
no `"assignTeam"` branch, and the lobby UI only rendered a read-only roster
with no per-player control. The backend was done; the last wire was never
connected, and nothing caught it because the tests exercised the usecase
function directly, never the transport surface a real host would actually
use. Fixed by adding the missing WS handler (same double-gated host-only
pattern as the existing `advance`/`configureTeams` actions) and a per-player
team-select control in the roster. Also fixed a real, reproduced test flake:
the room-code-uniqueness test drew 3000 codes from a 31^5-sized keyspace and
asserted *exact* uniqueness — a ~14% birthday-collision probability, which
the review run actually hit once. Fixed by drawing fewer codes and
tolerating one collision rather than demanding statistical perfection (room
codes are explicitly not a security boundary). Everything else — double-
gated host enforcement on the pre-existing actions, live-recomputed team
scoring with no double-counting on reassignment, genuine individual-mode
regression testing (not just "team functions return empty"), sane auto-split
edge cases, zero new persistent state — reviewed clean. 247/247 tests stable
across repeated runs, build green after both fixes.

## Slice 13 result — kartka-live-host-screen (roadmap complete)

The last slice on the currently-planned roadmap: a dedicated big-screen
host route with server-rendered QR-code join, a live "waiting for answers"
bar, reveal animation, and a podium screen. Double-gated host-only access
held up under scrutiny on both sides independently — the SSR host-check
endpoint fails closed on every failure mode traced (no cookie, wrong user,
unknown room, unreachable sidecar), and the WebSocket upgrade handler
independently re-checks `room.hostId` *before* upgrading, so a client
connecting directly to the host socket without ever loading the page is
still rejected. One should-fix, a test-coverage gap rather than a code bug:
the QR-rendering test suite checked structural well-formedness but never
cross-checked the hand-built SVG rect-merging logic against the real
`qrcode-generator` matrix — the reviewer verified correctness by hand (0
mismatches across 234 dark modules) but flagged that a rect-run off-by-one
would have slipped through the shipped tests undetected. Fixed by adding a
real module-by-module cross-check test. 263/263 tests, build green.

**This closes out the entire currently-planned live-quiz arc and roadmap**:
base MVP (slices 1-4: core scaffold, LLM-assist, sharing, admin), six
feature slices from the post-MVP brainstorm (5-10: FSRS, offline, rich
content, cram mode, reminders, a11y reading profile), and the full-Kahoot
arc (11-13: WebSocket core, teams, host screen) — 13 slices, each built by
an implementer agent and independently re-reviewed by a fresh-context
agent before merge. The review gate caught a real, non-hypothetical bug in
6 of those 13 passes (slice 1's IDOR, slice 4's banned-session gap, slice 7's
dead img allowlist, slice 8's timezone comparison, slice 11's cross-process
migration bug, slice 12's unwired feature) plus disclosed (not silently
skipped) three genuine browser-QA gaps (slices 6, 9, 11) that no tooling in
this environment could close. That's the core empirical result of this
dogfood: an unreviewed single-agent slice (the very first pass, before the
gate was reinstated per issue #29) shipped an exploitable bug; every
slice after, reviewed as a matter of course, either came back clean or had
its defect caught before merge.

## Slice 14 result — kartka-live-streaks-hints

The first slice past the originally-planned roadmap (14-17 were documented
future work, not required output): a streak bonus and per-player hint
mechanic for live quiz. The risk here was a different axis than slice 11's
new architecture — this slice modifies `submitReview`, the single most
reused/tested function in the entire app, to add a side effect (resolving
a durable "pending streak bonus" record — confirmed if the same card is
later answered correctly on a real review, forfeited otherwise). Reviewed
**clean, zero findings** — the reviewer specifically re-ran the five most
critical pre-existing test files in isolation and confirmed via `git diff`
they're byte-identical, verified the new `bonusRepo` parameter is genuinely
optional with every call site checked, and confirmed the bonus-resolution
side effect strictly runs after the real scheduling write already
succeeded, discarding its own result so it structurally cannot affect what
`submitReview` returns. Streak detection, duplicate-record prevention,
single-resolution, and the hint mechanic's per-type answer-leak safety
(especially multiple_choice's "eliminate one wrong option" correctly
filtering out the correct index first) were all deliberately tested against
adversarial fixtures, not just happy-path cases. 288/288 tests, build green,
zero changes needed post-review — the most delicate integration point in
the project so far held up without a single finding.

## Slice 15 result — kartka-live-post-game-review

The load-bearing slice for the whole full-Kahoot-mode condition: missed or
slow live-quiz questions get cloned into a personal auto-created practice
set and seeded with a shortened-due review state, right after the round
ends. The riskiest part of this slice was a deliberate, disclosed expansion
of the safety-constraint whitelist introduced in slice 8 (only
`reviewUsecases.ts` may call a scheduler's `.upsert()`) to also permit this
slice's new seed-only writer — reviewed with maximum adversarial tracing
(does the seed path ever construct a state that could plausibly overwrite
an existing row? could any client-suppliable input reach it? does it use
the real initial-state constructors or hand-rolled equivalents?) and found
sound: every seed targets a card id created moments earlier in the same
call, so it structurally cannot touch a card the player was already
reviewing, and every identity/provenance input traces back to the
server-authenticated WS connection.

The review did find a real, bounded (non-corrupting) concurrent-render race
— two finished-room broadcasts could both read "not yet imported" for the
same card before either wrote, producing a duplicate clone. Investigating
that fix surfaced a second, more serious instance of the identical
read-then-create pattern one level up: `findOrCreatePracticeSet` had the
same gap, so concurrent calls on a player's very first live round could
each create their own separate practice set entirely — at which point the
card-level fix alone wouldn't even have triggered, since the two duplicate
sets would have different ids. Both closed with DB-level partial unique
indexes (not in-process locks, which wouldn't help across the WS sidecar's
concurrent handlers) plus graceful conflict handling in the usecases, and
proven with a genuine concurrency test (5 real concurrent calls via
`Promise.all`, stable across repeated runs) rather than just a sequential
happy-path test. This is a good example of "fixing the reported symptom
surfaces the real root cause one layer up" — worth remembering as a general
review-fix discipline: when a race is found, check whether the same
read-then-create shape exists anywhere upstream of the fix, not just at the
reported call site. 302/302 tests, build green after both fixes.

## Replay debt

Not yet applicable — no slice has archived yet (deliberately: pending a full
review pass per #29 before any archive).
