---
name: gw-review
description: Review an implemented change at the PR gate — code review against plan, standards, and the goal's recalled constraints/invariants, PLUS the memory human gate; assemble the disputed-node checklist, staleness queue, and promotion candidates the human must rule on. Use when a change reaches PR / review time, after /gw-implement or /gw-goal. Trigger phrases: "review the change", "PR review", "/gw-review".
---

# gw-review

The review boundary is where the two halves of the lifecycle meet the human: the
code (does it match the plan and the standards?) and the graph (what did this
change dispute, and what deserves to outlive it?). The agent surfaces; the human
resolves. That split is the safety model.

## Part 1 — Code review

`/gw-review` runs as a **fresh agent session with a clean context** — it does not
inherit the implementer's memory of what the constraints were. Recall is therefore
not a formality here; it is the only channel through which the change's acceptance
criteria reach the reviewer. Unlike every other recall in the lifecycle (which
loads context to *produce* work), this one loads the criteria to *check finished
work against them*.

Standard 10x-impl-review discipline against `context/changes/<change-id>/`:

1. **Recall the acceptance criteria — mandatory.**

   ```
   recall_context(query="<goal text + the subsystems the diff touches>",
                  goal_ref=<goal_node_id from change.md>)
   ```

   Review the diff against the **settled** `constraint` and `invariant` blocks it
   returns (`tier=lifetime`/`long-term`) — these are the spec the code must
   satisfy. A violated settled constraint is a finding of the same weight as a
   dangerous-decision, not a stylistic note.

   Keep `disputed` blocks out of Part 1: adjudicating a contested constraint
   against the code is re-litigation, which the safety model forbids the agent.
   Note the disputed handles and carry them to Part 2, where the human rules.

2. Diff vs `plan.md`: drift from planned phases, unplanned files touched,
   verification steps skipped. Drift is not automatically wrong — but undisclosed
   drift is.
3. Dangerous-decision scan and repo-standards compliance.
4. Check the plan's `[node:<id>]` references against what was actually built —
   a plan decision silently not honored in code is a finding.

**When the code contradicts a settled constraint — it depends.** Do not resolve
this upfront; the direction is the developer's judgment at the moment it happens:
- the code is wrong and the constraint stands → a code finding (request changes);
- the code is right and the constraint is now obsolete → record `CONTRADICTED`
  (or capture the correcting artifact with a CONTRADICTS edge) and let it flag for
  the Part 2 human gate.

Surface the conflict with both readings and the evidence; never silently pick one.

## Part 2 — Memory review (the human gate)

1. **Collect the queue.** Every node that appeared `disputed` in this change's
   recall bundles, every node the change's own CONTRADICTS links/events flagged,
   plus the store-wide `stale_nodes()` read for anything this change touched.

   Also read the **store-wide** health signal — the total unresolved flag/stale
   count and the age of the oldest one — and report it in the checklist. Recall
   only serves the live set, so a queue nobody works rots silently between gates;
   this is the one gate that reliably runs, so it is where queue rot must become
   visible. This is a read-and-report only: the reviewer never clears flags here
   (that is the GUI's human-only action).

2. **Write the checklist into the PR description / review notes:**

   ```markdown
   ## Memory review (human gate)
   Store health: 14 unresolved flags (oldest 23 days). ⚠️ growing — work the queue.

   Disputed nodes touched by this change:
   - [node:<id>] <one-line content> — contradicted by <id/evidence>

   Promotion candidates (CONFIRMED, look durable):
   - [node:<id>] <one-line content> — suggest mid-term → long-term

   Open the review queue: `uv run agentic-memory-gui` → Review tab.
   ```

   The `Store health` line is store-wide, not change-scoped: it makes the standing
   backlog visible at every PR even when this change's own queue is empty.

3. **Tell the human what the GUI offers:** severity plus the rules-resolver
   verdict as a hint, one-click clear for false alarms, tier controls for
   promotions — lifetime promotion requires explicit confirmation there. Every
   human write is journaled, so manual intervention never breaks derived state.

4. **Consolidate the episode (episodic → semantic).** After merge the change's
   un-promoted detail goes dormant — so distill NOW what must outlive it:

   - Capture **one change-summary artifact**: what this change did, the outcome,
     and why — written to be read cold by a future change that recalls this
     territory. Type `concept`, tier `mid-term`, with DEPENDS_ON edges to the
     change's key decision/constraint nodes (so recalling the summary pulls the
     specifics within reach even when they are dormant).
   - Re-read the change's captured artifacts and pick the ones with cross-change
     value: constraints and invariants almost always qualify; decisions qualify
     when a future change could plausibly reverse them unknowingly; narrationish
     leftovers do not.

5. **Suggest, never resolve.** List the change-summary node plus the mid-term
   artifacts that were CONFIRMED and read as durable as **promotion candidates**,
   each with a one-line why. This list is what survives in live recall after the
   sweep — an unpromoted candidate goes dormant with the rest. The human promotes
   in the GUI; the agent never does.

6. An empty queue is a valid outcome — say so explicitly and move on; do not
  manufacture findings.

## Verdict

Close with one of:
- **Approve** — code matches plan/standards, memory queue is presented (empty or
  handed over) → route to merge + `/gw-archive`.
- **Request changes** — findings listed most-severe first, each with the evidence.
  Rework happens under the same change-id; the memory scope stays active.

## Rules

- Never clear flags, adjust trust/weights, or change tiers — the MCP surface
  cannot, and working around it via the GUI or scripts breaks the model.
- Journal the review itself — one batch covering both parts:
  - `CONFIRMED` **only** for a constraint/invariant the review actively exercised
    (ran its test, traced the path to ground). Review is the strongest source of
    CONFIRMED in the lifecycle; "I read it and it looks right" is not that — that
    is `REVIEWED`. Inflating CONFIRMED at the one gate that fires every PR quietly
    corrupts trust-folding.
  - `REVIEWED` for nodes re-assessed with no new evidence either way (most of
    Part 2). Honest reads feed ranking too.
- Review capacity is the parallelism cap. If the queue of changes awaiting this
  gate grows, stop opening new ones — that is the throughput limit working as
  designed.
