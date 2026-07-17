---
name: gw-review
description: Review an implemented change at the PR gate — code review against plan and standards, PLUS the memory human gate; assemble the disputed-node checklist, staleness queue, and promotion candidates the human must rule on. Use when a change reaches PR / review time, after /gw-implement or /gw-goal. Trigger phrases: "review the change", "PR review", "/gw-review".
---

# gw-review

The review boundary is where the two halves of the lifecycle meet the human: the
code (does it match the plan and the standards?) and the graph (what did this
change dispute, and what deserves to outlive it?). The agent surfaces; the human
resolves. That split is the safety model.

## Part 1 — Code review

Standard 10x-impl-review discipline against `context/changes/<change-id>/`:

1. Diff vs `plan.md`: drift from planned phases, unplanned files touched,
   verification steps skipped. Drift is not automatically wrong — but undisclosed
   drift is.
2. Dangerous-decision scan and repo-standards compliance.
3. Check the plan's `[node:<id>]` references against what was actually built —
   a plan decision silently not honored in code is a finding.

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
- Journal the review itself: `append_events` with `REVIEWED` for nodes you
  re-assessed during Part 2 (no new evidence either way) — honest reads feed
  ranking too.
- Review capacity is the parallelism cap. If the queue of changes awaiting this
  gate grows, stop opening new ones — that is the throughput limit working as
  designed.
