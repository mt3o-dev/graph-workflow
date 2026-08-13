---
name: gw-goal
description: Headless, goal-directed execution of a bounded change (the "Ralph Wiggum loop" — run, check, retry) with the memory discipline compressed to its minimum viable form. Use for clear, well-defined tasks where plan.md exists and no mid-flight human judgment is needed; humans re-enter at PR/merge. Trigger phrases: "run this headless", "goal mode", "/gw-goal", claude -p execution.
---

# gw-goal

The headless twin of /gw-implement. Same lifecycle position, different validity
path: no human gates mid-flight — correctness is carried by deterministic checks
(tests, linters, the plan's per-phase verification) plus the evaluator agent
downstream, with humans only at PR/merge. The memory loop still runs; it is the
only channel through which an unattended session reports what it learned.

## Preconditions — refuse to start headless if any fail

1. `context/changes/<change-id>/plan.md` exists with per-phase verification
   commands. No plan → route to /gw-plan; headless without a plan is drift.
2. `memory_goal` present in change.md.
3. The task is bounded: the stop condition is checkable by a command, not by
   taste. "Make it better" is not a goal; "all tests in tests/invoicing pass with
   VAT rounded half-up" is.

## The loop

```
recall → attempt → verify → (fail: diagnose, retry ≤ N) → capture+journal → next phase
```

1. **Recall once per phase** (`recall_context(query=<phase>, goal_ref=...)`).
   Treat recalled `constraint`/`invariant` blocks as hard requirements — headless
   mode has no human to catch a violated constraint later. A `disputed` node that
   materially affects the phase is a **stop condition**: do not gamble on either
   side unattended — note it, skip or fail the phase, leave it for the PR gate.
   Journal the stop into the graph, not just the run report: a `NOTED` event on
   the disputed node with the blocking evidence in `reason` ("blocked headless
   phase 2 of <change-id>"). A dispute that blocks work is the strongest
   prioritization signal the review-queue owner can get — left only in a file it
   is invisible to the store.

2. **Attempt + verify.** Run the phase's verification command after every attempt.
   Bounded retries (default 3); on exhaustion, record an `issue` artifact with the
   failure evidence and stop — a truthful partial result beats a flailing loop.

3. **Capture + journal at each phase boundary**, exactly as /gw-implement steps
   3–4, but leaner: in headless mode prefer fewer, harder artifacts (discovered
   constraints, standing issues, reversed decisions with CONTRADICTS edges) and a
   single `append_events` batch per phase. This is the session's flight recorder —
   an unattended run that captures nothing might as well not have happened.

## On exit (success or stop)

- Update change.md status (`implemented` / `blocked: <reason>`).
- Emit a run report: phases completed, verification results, artifacts captured
  (`[node:<id>]` list), contradictions recorded, retries burned. This report is
  what the human reads before /gw-review.
- Never merge, never archive, never resolve flags — those live at the human end
  of the lifecycle.

## Which skills may run headless

`/gw-implement`'s per-phase work compresses into this loop cleanly. Two of the newer
skills do not, and one does conditionally:

- **`/gw-fix`** — headless **only when the reproduction is already a failing test**
  someone else wrote. Reproduction is judgment: an unattended agent that cannot
  reproduce will fix something adjacent and report success. With a red test in hand
  the loop is fully command-verifiable.
- **`/gw-domain`** and **`/gw-wireframe`** — never. Both are defined by a user in the
  loop (elicitation, per-screen review); running them unattended produces exactly the
  invented domain and one-shot UI they exist to prevent.
- **`/gw-consolidate`** and **`/gw-ideate`** — the read halves are safe to run
  headless and report; the commits (consolidating, opening changes) are not.

## Rules

- One change per worktree, one fresh context per run. Parallelism is capped by
  review capacity: more headless agents without review is more unreviewed code,
  not more throughput.
- Deterministic validity only: if a phase's correctness cannot be checked by a
  command, that phase does not belong in headless mode — split it out for
  /gw-implement.
- All /gw-implement rules apply: no trust/flag/tier/archive mutation, honest
  events only, `context/archive/` is untouchable — including the phase-parallel
  execution conditions (disjoint ownership, contracts captured before the
  consumer starts) when phases fan out to subagents.
